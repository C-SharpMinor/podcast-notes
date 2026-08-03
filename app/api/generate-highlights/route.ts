import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { strictRatelimit } from "@/utils/ratelimit";

export const maxDuration = 60;

interface TranscriptSegment {
	start: number;
	end: number;
	text: string;
}

export async function POST(req: Request) {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const { success } = await strictRatelimit.limit(user.id);
	if (!success) {
		return NextResponse.json(
			{ error: "Too many requests, slow down." },
			{ status: 429 },
		);
	}

	const { episodeKey, episodeTitle, segments } = await req.json();
	if (!episodeKey || !Array.isArray(segments) || segments.length === 0) {
		return NextResponse.json(
			{ error: "episodeKey and segments are required" },
			{ status: 400 },
		);
	}

	const { data: existing } = await supabase
		.from("episode_highlights")
		.select("*")
		.eq("episode_key", episodeKey)
		.maybeSingle();

	if (existing?.status === "ready") {
		return NextResponse.json({ highlights: existing.highlights });
	}

	await supabase
		.from("episode_highlights")
		.upsert(
			{ episode_key: episodeKey, status: "processing", highlights: [] },
			{ onConflict: "episode_key" },
		);

	try {
		const transcriptWithMarkers = (segments as TranscriptSegment[])
			.map((s) => `[${Math.floor(s.start)}] ${s.text}`)
			.join(" ");

		const systemPrompt = `You are analyzing a full podcast transcript to surface a small number of genuinely noteworthy moments for a listener's notebook.
The podcast is called "${episodeTitle || "this episode"}".

Each segment below starts with a timestamp in seconds in brackets, like [125]. Use the bracket timestamp closest to a moment when you reference it.

TRANSCRIPT:
"""
${transcriptWithMarkers}
"""

Find at most 8 of the most genuinely noteworthy moments — surprising claims, strong opinions, striking phrasing worth quoting directly, or clearly itemized lists the speaker walks through (even with substantial explanation between items — follow the speaker's own numbering like "firstly... secondly... finally").

Return ONLY a valid JSON object with this shape:
{
  "highlights": [
    {
      "timestamp": <number, seconds, from the nearest bracket marker>,
      "type": "highlight" | "list",
      "summary": "<one sentence describing the moment>",
      "quote": "<a striking near-verbatim quote, or null for list type>",
      "list_items": ["<item 1>", "<item 2>", ...] or null if type is "highlight"
    }
  ]
}
Prefer fewer, higher-quality highlights over padding the list. If nothing genuinely stands out, return an empty array.`;

		const groqRes = await fetch(
			"https://api.groq.com/openai/v1/chat/completions",
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
				},
				body: JSON.stringify({
					model: "openai/gpt-oss-20b",
					messages: [{ role: "system", content: systemPrompt }],
					response_format: { type: "json_object" },
				}),
			},
		);

		if (!groqRes.ok) {
			throw new Error(
				`Groq request failed: ${groqRes.status} ${await groqRes.text()}`,
			);
		}

		const data = await groqRes.json();
		if (!data.choices?.[0]?.message?.content) {
			throw new Error("No content returned from model");
		}

		const rawContent = data.choices[0].message.content;
		let parsed: any = {};
		try {
			const jsonStart = rawContent.indexOf("{");
			const jsonEnd = rawContent.lastIndexOf("}");
			parsed =
				jsonStart !== -1 && jsonEnd !== -1
					? JSON.parse(rawContent.substring(jsonStart, jsonEnd + 1))
					: JSON.parse(rawContent);
		} catch {
			parsed = { highlights: [] };
		}

		const highlights = Array.isArray(parsed.highlights)
			? parsed.highlights
			: [];

		await supabase
			.from("episode_highlights")
			.update({ status: "ready", highlights })
			.eq("episode_key", episodeKey);
		return NextResponse.json({ highlights });
	} catch (err: any) {
		console.error("Highlight generation failed:", err.message);
		await supabase
			.from("episode_highlights")
			.update({ status: "failed" })
			.eq("episode_key", episodeKey);
		return NextResponse.json(
			{ error: "Failed to generate highlights" },
			{ status: 500 },
		);
	}
}

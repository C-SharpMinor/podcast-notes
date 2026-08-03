import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { strictRatelimit } from "@/utils/ratelimit";
import { getOrganizedNoteStyleExample } from "@/utils/getStyleExamples";

export async function POST(req: Request) {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user)
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const { success } = await strictRatelimit.limit(user.id);
	if (!success)
		return NextResponse.json(
			{ error: "Too many requests, slow down." },
			{ status: 429 },
		);

	const { episodeId, episodeTitle } = await req.json();
	if (!episodeTitle)
		return NextResponse.json(
			{ error: "episodeTitle is required" },
			{ status: 400 },
		);

	try {
		let notesQuery = supabase
			.from("user_notes")
			.select("*")
			.eq("user_id", user.id)
			.order("timestamp_seconds", { ascending: true });
		notesQuery = episodeId
			? notesQuery.eq("episode_id", episodeId)
			: notesQuery.is("episode_id", null).eq("episode_title", episodeTitle);
		const { data: notes, error: notesErr } = await notesQuery;

		if (notesErr || !notes || notes.length === 0) {
			return NextResponse.json(
				{ error: "No captured notes found for this episode" },
				{ status: 400 },
			);
		}

		const formatTime = (s: number) =>
			`${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
		const rawMaterial = notes
			.map((n) => {
				const parts = [
					`[${formatTime(n.timestamp_seconds)}] ${n.ai_summary || ""}`,
				];
				if (n.refined_quote) parts.push(`Quote: "${n.refined_quote}"`);
				if (
					n.list_items &&
					Array.isArray(n.list_items) &&
					n.list_items.length > 0
				) {
					parts.push(`List: ${n.list_items.join(" | ")}`);
				}
				return parts.join(" — ");
			})
			.join("\n");

		const styleExample = await getOrganizedNoteStyleExample(supabase, user.id);

		const systemPrompt = `You are helping a user turn the individual moments they captured while listening to a podcast episode called "${episodeTitle}" into one cohesive, well-organized, readable note.

CAPTURED MOMENTS (chronological):
"""
${rawMaterial}
"""
${styleExample ? `\n${styleExample}\n` : ""}
Write ONE organized note that:
- Groups related points together rather than forcing strict chronological order if that reads better
- Uses "## " section headers only if the content genuinely spans distinct topics — otherwise clean flowing structure is fine
- Preserves genuinely striking direct quotes in quotation marks where they add value
- Preserves any itemized lists faithfully, using "- " for each item
- Reads like real, useful personal notes — not a transcript, not a generic summary, not just the fragments concatenated

Return ONLY a JSON object: { "organized_note": "<the full note as text, using ## and - where appropriate>" }`;

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

		if (!groqRes.ok)
			throw new Error(
				`Groq request failed: ${groqRes.status} ${await groqRes.text()}`,
			);
		const data = await groqRes.json();
		const rawContent = data.choices?.[0]?.message?.content;
		if (!rawContent) throw new Error("No content returned from model");

		let parsed: any = {};
		try {
			const jsonStart = rawContent.indexOf("{");
			const jsonEnd = rawContent.lastIndexOf("}");
			parsed =
				jsonStart !== -1 && jsonEnd !== -1
					? JSON.parse(rawContent.substring(jsonStart, jsonEnd + 1))
					: JSON.parse(rawContent);
		} catch {
			parsed = { organized_note: rawContent };
		}

		const content = parsed.organized_note || "";

		let existingQuery = supabase
			.from("episode_notes")
			.select("id")
			.eq("user_id", user.id);
		existingQuery = episodeId
			? existingQuery.eq("episode_id", episodeId)
			: existingQuery.is("episode_id", null).eq("episode_title", episodeTitle);
		const { data: existing } = await existingQuery.maybeSingle();

		if (existing) {
			await supabase
				.from("episode_notes")
				.update({
					content,
					source_note_count: notes.length,
					updated_at: new Date().toISOString(),
				})
				.eq("id", existing.id);
		} else {
			await supabase
				.from("episode_notes")
				.insert({
					user_id: user.id,
					episode_id: episodeId || null,
					episode_title: episodeTitle,
					content,
					source_note_count: notes.length,
				});
		}

		return NextResponse.json({ content, sourceNoteCount: notes.length });
	} catch (err: any) {
		console.error("Episode note generation failed:", err.message);
		return NextResponse.json(
			{ error: "Failed to generate organized note" },
			{ status: 500 },
		);
	}
}

import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { strictRatelimit } from "@/utils/ratelimit";

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

	try {
		const formData = await req.formData();
		const audioFile = formData.get("audio") as Blob;
		const timestamp = formData.get("timestamp");
		const episodeTitle = formData.get("episodeTitle");
		const sourceContext = (formData.get("sourceContext") as string) || "";

		if (!audioFile) {
			return NextResponse.json(
				{ error: "No audio file provided" },
				{ status: 400 },
			);
		}

		// PHASE 1: transcribe the user's spoken instruction
		const ext = audioFile.type.includes("mp4") ? "mp4" : "webm";
		const groqFormData = new FormData();
		groqFormData.append("file", audioFile, `voice-note.${ext}`);
		groqFormData.append("model", "whisper-large-v3-turbo");
		groqFormData.append("response_format", "json");

		const whisperResponse = await fetch(
			"https://api.groq.com/openai/v1/audio/transcriptions",
			{
				method: "POST",
				headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
				body: groqFormData,
			},
		);

		if (!whisperResponse.ok) {
			throw new Error(`Whisper request failed: ${whisperResponse.status}`);
		}
		const whisperData = await whisperResponse.json();
		if (whisperData.error) throw new Error("Failed to transcribe audio");

		const spokenNote = (whisperData.text || "").trim();
		const cleanNote = spokenNote.replace(/[^a-zA-Z0-9]/g, "");
		if (cleanNote.length < 2) {
			return NextResponse.json(
				{ error: "Audio was silent or unclear." },
				{ status: 400 },
			);
		}

		// PHASE 2: ground the note in what was ACTUALLY said in the podcast
		const hasSource = sourceContext.trim().length > 0;

		const systemPrompt = `You are an intelligent podcast note-taking assistant.
The user is listening to a podcast called "${episodeTitle}".

${
	hasSource
		? `Here is what was actually said in the podcast in the ~45 seconds before they spoke. This is the SOURCE MATERIAL — quote and summarize FROM THIS, not from the user's own words:
"""
${sourceContext}
"""`
		: `No transcript of the podcast was available for this moment.`
}

The user triggered a voice note at timestamp ${timestamp}s and said: "${spokenNote}" — treat this as their INSTRUCTION for what to capture, not as content to quote itself.

Return ONLY a valid JSON object with exactly these three keys:
- "summary": a one-sentence summary of the relevant point from the source material, guided by the user's instruction.
- "emotional_flag": a single word describing the vibe (e.g., "Inspiring", "Technical", "Insightful", "Funny").
- "refined_quote": the most relevant quote from the SOURCE MATERIAL matching what the user wanted noted. ${hasSource ? "" : "Since no source transcript was available, fall back to a polished version of what the user said, and mention in the summary that no source match was found."}`;

		const llamaResponse = await fetch(
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

		const llamaData = await llamaResponse.json();

		if (!llamaData.choices || llamaData.error) {
			console.error(
				"Groq chat model rejected the request:",
				llamaData.error || llamaData,
			);
			return NextResponse.json({
				summary: "AI processing error. Check server logs.",
				emotional_flag: "ERROR",
				refined_quote: "Failed to generate AI note.",
				raw_transcript: spokenNote,
			});
		}

		const rawAiContent = llamaData.choices[0].message.content;
		let aiResult: any = {};
		try {
			const jsonStart = rawAiContent.indexOf("{");
			const jsonEnd = rawAiContent.lastIndexOf("}");
			aiResult =
				jsonStart !== -1 && jsonEnd !== -1
					? JSON.parse(rawAiContent.substring(jsonStart, jsonEnd + 1))
					: JSON.parse(rawAiContent);
		} catch {
			aiResult = {
				summary: "AI formatting error.",
				emotional_flag: "ERROR",
				refined_quote: rawAiContent,
			};
		}

		return NextResponse.json({ ...aiResult, raw_transcript: spokenNote });
	} catch (error) {
		console.error("Server Pipeline Error:", error);
		return NextResponse.json(
			{ error: "Failed to process voice note" },
			{ status: 500 },
		);
	}
}

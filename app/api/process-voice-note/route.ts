import { NextResponse } from "next/server";

export async function POST(req: Request) {
	try {
		// 1. Receive the audio file and context from the frontend
		const formData = await req.formData();
		const audioFile = formData.get("audio") as Blob;
		const timestamp = formData.get("timestamp");
		const episodeTitle = formData.get("episodeTitle");

		if (!audioFile) {
			return NextResponse.json(
				{ error: "No audio file provided" },
				{ status: 400 },
			);
		}

		// 2. PHASE 1: Send the Audio to Groq's Whisper API
		// We have to pack it into a new FormData object for Groq
		const groqFormData = new FormData();
		groqFormData.append("file", audioFile, "voice-note.webm");
		groqFormData.append("model", "whisper-large-v3-turbo"); // Groq's insanely fast Whisper model
		groqFormData.append("response_format", "json");

		const whisperResponse = await fetch(
			"https://api.groq.com/openai/v1/audio/transcriptions",
			{
				method: "POST",
				headers: {
					Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
				},
				body: groqFormData,
			},
		);

		const whisperData = await whisperResponse.json();

		if (whisperData.error) {
			console.error("Whisper Error:", whisperData.error);
			throw new Error("Failed to transcribe audio");
		}

		const spokenNote = whisperData.text.trim();
		console.log("🗣️ WHISPER HEARD:", spokenNote);

		// If it's just a period, comma, or less than 2 real letters, kill the process
		const cleanNote = spokenNote.replace(/[^a-zA-Z0-9]/g, "");
		if (cleanNote.length < 2) {
			console.log("⚠️ No significant speech detected. Stopping.");
			return NextResponse.json(
				{ error: "Audio was silent or unclear." },
				{ status: 400 },
			);
		}
		// ----------------------------------------

		if (!spokenNote) {
			return NextResponse.json(
				{ error: "Audio was silent or unclear." },
				{ status: 400 },
			);
		}

		// 3. PHASE 2: Send the Transcription to Groq's Llama 3 API
		const llamaResponse = await fetch(
			"https://api.groq.com/openai/v1/chat/completions",
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
				},
				body: JSON.stringify({
					model: "llama-3.1-8b-instant",
					messages: [
						{
							role: "system",
							content: `You are an intelligent podcast note-taking assistant. 
            The user is listening to a podcast called "${episodeTitle}". 
            They triggered a voice note at timestamp ${timestamp}s by saying: "${spokenNote}".
            
            Synthesize their thought into a structured note.
            You MUST return ONLY a valid JSON object with exactly these three keys:
            - "summary": A clean, one-sentence summary of the note.
            - "emotional_flag": A single word describing the vibe (e.g., "Inspiring", "Technical", "Insightful", "Funny").
            - "refined_quote": A polished, professional version of what they said.`,
						},
					],
					response_format: { type: "json_object" },
				}),
			},
		);

		const llamaData = await llamaResponse.json();

		// --- 🚨 NEW: CATCH THE EXACT LLAMA ERROR ---
		if (!llamaData.choices || llamaData.error) {
			console.error(
				"❌ GROQ LLAMA REJECTED THE REQUEST:",
				JSON.stringify(llamaData.error || llamaData, null, 2),
			);

			// Return a safe fallback so the frontend doesn't crash, allowing you to at least save the Whisper transcript!
			return NextResponse.json({
				summary: "Llama API Error. Check VS Code Terminal.",
				emotional_flag: "ERROR",
				refined_quote: "Failed to generate AI note.",
				raw_transcript: spokenNote,
			});
		}
		// -------------------------------------------

		const rawAiContent = llamaData.choices[0].message.content;
		console.log("🤖 RAW LLAMA RESPONSE:", rawAiContent);

		// 4. PHASE 3: The Markdown-JSON Conflict Fix
		let aiResult = {};
		try {
			// Mathematically slice out ONLY what is between the curly brackets
			const jsonStart = rawAiContent.indexOf("{");
			const jsonEnd = rawAiContent.lastIndexOf("}");

			if (jsonStart !== -1 && jsonEnd !== -1) {
				const cleanJsonString = rawAiContent.substring(jsonStart, jsonEnd + 1);
				aiResult = JSON.parse(cleanJsonString);
			} else {
				aiResult = JSON.parse(rawAiContent); // Fallback
			}
		} catch (error) {
			console.error("❌ JSON Parse Error. Llama returned bad formatting.");
			aiResult = {
				summary: "AI formatting error.",
				emotional_flag: "ERROR",
				refined_quote: rawAiContent,
			};
		}

		// Return the clean JSON + the raw transcript so you can save both to the database
		return NextResponse.json({ ...aiResult, raw_transcript: spokenNote });
	} catch (error) {
		console.error("Server Pipeline Error:", error);
		return NextResponse.json(
			{ error: "Failed to process voice note" },
			{ status: 500 },
		);
	}
}

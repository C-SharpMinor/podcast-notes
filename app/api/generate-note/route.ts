import { NextResponse } from "next/server";

export async function POST(req: Request) {
	try {
		const { spokenNote, timestamp, episodeTitle } = await req.json();

		if (!spokenNote) {
			return NextResponse.json(
				{ error: "No spoken note provided" },
				{ status: 400 },
			);
		}

		// Pointing to Groq's OpenAI-compatible endpoint
		const response = await fetch(
			"https://api.groq.com/openai/v1/chat/completions",
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
				},
				body: JSON.stringify({
					model: "llama3-8b-8192", // Fast, free, and great at JSON
					messages: [
						{
							role: "system",
							content: `You are an intelligent podcast note-taking assistant. 
            The user is listening to a podcast called "${episodeTitle}". 
            They triggered a voice note at timestamp ${timestamp}s by saying: "${spokenNote}".
            
            Synthesize their thought into a structured note.
            You MUST return ONLY a valid JSON object with exactly these three keys:
            - "summary": A clean, one-sentence summary of the note.
            - "emotional_flag": A single word describing the vibe (e.g., "Inspiring", "Technical", "Insightful", "Funny", "Heart-stirring").
            - "refined_quote": A polished, professional version of what they said.`,
						},
					],
					response_format: { type: "json_object" },
				}),
			},
		);

		const data = await response.json();

		if (data.error) {
			console.error("❌ GROQ API REJECTED THE REQUEST:", data.error);
			return NextResponse.json(
				{
					summary: "API Error. Check Terminal.",
					emotional_flag: "ERROR",
					refined_quote: data.error.message,
				},
				{ status: 400 },
			);
		}

		if (!data.choices || data.choices.length === 0) {
			console.error("❌ NO DATA RETURNED:", data);
			return NextResponse.json(
				{ error: "No choices returned" },
				{ status: 500 },
			);
		}

		// Grab the raw string output from the AI
		const rawAiContent = data.choices[0].message.content;
		console.log("🤖 RAW AI RESPONSE:", rawAiContent); // Prints to your VS Code terminal

		let aiResult = {};

		try {
			// Bulletproof JSON Extractor
			const jsonStart = rawAiContent.indexOf("{");
			const jsonEnd = rawAiContent.lastIndexOf("}");

			if (jsonStart !== -1 && jsonEnd !== -1) {
				const cleanJsonString = rawAiContent.substring(jsonStart, jsonEnd + 1);
				aiResult = JSON.parse(cleanJsonString);
			} else {
				aiResult = JSON.parse(rawAiContent);
			}
		} catch (error) {
			console.error("❌ JSON Parse Error. The AI returned bad formatting.");
			aiResult = {
				summary: "AI formatting error.",
				emotional_flag: "ERROR",
				refined_quote: rawAiContent,
			};
		}

		return NextResponse.json(aiResult);
	} catch (error) {
		console.error("API Error:", error);
		return NextResponse.json(
			{ error: "Failed to generate AI note" },
			{ status: 500 },
		);
	}
}

// app/api/transcribe-episode/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { strictRatelimit } from "@/utils/ratelimit";

export const maxDuration = 60;

export async function POST(req: Request) {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user)
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const { success } = await strictRatelimit.limit(user.id);
	if (!success) {
		return NextResponse.json(
			{ error: "Too many requests, slow down." },
			{ status: 429 },
		);
	}
	const { audioUrl, storagePath } = await req.json();
	if (!audioUrl && !storagePath) {
		return NextResponse.json(
			{ error: "audioUrl or storagePath is required" },
			{ status: 400 },
		);
	}

	const cacheKey = storagePath || audioUrl; // stable identifier either way

	const { data: existing } = await supabase
		.from("episode_transcripts")
		.select("*")
		.eq("audio_url", cacheKey)
		.maybeSingle();

	if (existing?.status === "ready") {
		return NextResponse.json({ segments: existing.segments });
	}

	await supabase
		.from("episode_transcripts")
		.upsert(
			{ audio_url: cacheKey, status: "processing", segments: [] },
			{ onConflict: "audio_url" },
		);

	try {
		let fetchUrl = audioUrl;
		if (storagePath) {
			const { data: signed, error: signErr } = await supabase.storage
				.from("episode-audio")
				.createSignedUrl(storagePath, 3600);
			if (signErr || !signed) throw new Error("Could not sign storage URL");
			fetchUrl = signed.signedUrl;
		}

		const groqForm = new FormData();
		groqForm.append("url", fetchUrl);
		groqForm.append("model", "whisper-large-v3-turbo");
		groqForm.append("response_format", "verbose_json");
		groqForm.append("timestamp_granularities[]", "segment");

		const groqRes = await fetch(
			"https://api.groq.com/openai/v1/audio/transcriptions",
			{
				method: "POST",
				headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
				body: groqForm,
			},
		);
		if (!groqRes.ok)
			throw new Error(
				`Groq transcription failed: ${groqRes.status} ${await groqRes.text()}`,
			);

		const data = await groqRes.json();
		const segments = (data.segments || []).map((s: any) => ({
			start: s.start,
			end: s.end,
			text: (s.text || "").trim(),
		}));

		await supabase
			.from("episode_transcripts")
			.update({ status: "ready", segments })
			.eq("audio_url", cacheKey);
		return NextResponse.json({ segments });
	} catch (err: any) {
		console.error("Episode transcription failed:", err.message);
		await supabase
			.from("episode_transcripts")
			.update({ status: "failed" })
			.eq("audio_url", cacheKey);
		return NextResponse.json(
			{ error: "Failed to transcribe episode" },
			{ status: 500 },
		);
	}
}

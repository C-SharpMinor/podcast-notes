import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import dns from "dns/promises";

export const maxDuration = 300;

async function isSafeUrl(url: string) {
	const parsed = new URL(url);
	if (!["http:", "https:"].includes(parsed.protocol)) return false;
	const { address } = await dns.lookup(parsed.hostname);
	const priv = /^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/;
	return !priv.test(address) && address !== "::1";
}

async function resolveFinalUrl(url: string): Promise<string> {
	const res = await fetch(url, {
		method: "GET",
		redirect: "follow",
		signal: AbortSignal.timeout(20_000),
		headers: {
			"User-Agent":
				"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
		},
	});
	const finalUrl = res.url;
	await res.body?.cancel();
	return finalUrl;
}

export async function POST(req: Request) {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user)
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	let audioUrl: string | undefined;
	let storagePath: string | undefined;
	try {
		const body = await req.json();
		audioUrl = body.audioUrl;
		storagePath = body.storagePath;
	} catch {
		// Empty or malformed body — likely a stale/aborted request racing a real one. Fail quietly.
		return NextResponse.json(
			{ error: "Invalid request body" },
			{ status: 400 },
		);
	}

	if (!audioUrl && !storagePath) {
		return NextResponse.json(
			{ error: "audioUrl or storagePath is required" },
			{ status: 400 },
		);
	}

	if (audioUrl && !(await isSafeUrl(audioUrl))) {
		return NextResponse.json(
			{ error: "This URL isn't allowed." },
			{ status: 400 },
		);
	}

	const cacheKey = storagePath || audioUrl!;

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
		let sourceUrl = audioUrl;
		if (storagePath) {
			const { data: signed, error: signErr } = await supabase.storage
				.from("episode-audio")
				.createSignedUrl(storagePath, 3600);
			if (signErr || !signed) throw new Error("Could not sign storage URL");
			sourceUrl = signed.signedUrl;
		}

		console.log("Resolving redirect for", sourceUrl);
		const finalUrl = await resolveFinalUrl(sourceUrl!);
		console.log("Resolved to", finalUrl, "— sending to Groq...");

		const groqForm = new FormData();
		groqForm.append("url", finalUrl);
		groqForm.append("model", "whisper-large-v3-turbo");
		groqForm.append("response_format", "verbose_json");
		groqForm.append("timestamp_granularities[]", "segment");

		const groqRes = await fetch(
			"https://api.groq.com/openai/v1/audio/transcriptions",
			{
				method: "POST",
				headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
				body: groqForm,
				signal: AbortSignal.timeout(240_000),
			},
		);

		if (!groqRes.ok) {
			const errText = await groqRes.text();
			const isTooLarge = errText.includes("too large");
			console.error(`Groq transcription failed: ${groqRes.status} ${errText}`);
			await supabase
				.from("episode_transcripts")
				.update({ status: "failed" })
				.eq("audio_url", cacheKey);
			return NextResponse.json(
				{
					error: isTooLarge
						? "This episode is too long to transcribe right now (file size limit)."
						: "Failed to transcribe episode",
				},
				{ status: 500 },
			);
		}

		const data = await groqRes.json();
		const segments = (data.segments || []).map((s: any) => ({
			start: s.start,
			end: s.end,
			text: (s.text || "").trim(),
		}));

		console.log(`Transcription complete: ${segments.length} segments`);
		await supabase
			.from("episode_transcripts")
			.update({ status: "ready", segments })
			.eq("audio_url", cacheKey);
		return NextResponse.json({ segments });
	} catch (err: any) {
		const reason =
			err.name === "TimeoutError" ? "Request timed out" : err.message;
		console.error("Episode transcription failed:", reason);
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

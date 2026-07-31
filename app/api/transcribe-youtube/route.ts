import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { strictRatelimit } from "@/utils/ratelimit";

export const maxDuration = 30;

function extractVideoId(url: string): string | null {
	const m = url.match(
		/(?:youtube\.com\/watch\?v=|youtube\.com\/embed\/|youtu\.be\/)([\w-]{11})/,
	);
	return m ? m[1] : null;
}

function decodeHtmlEntities(text: string): string {
	return text
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)));
}

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
	const { videoUrl } = await req.json();
	if (!videoUrl)
		return NextResponse.json(
			{ error: "videoUrl is required" },
			{ status: 400 },
		);

	const videoId = extractVideoId(videoUrl);
	if (!videoId)
		return NextResponse.json(
			{ error: "Could not parse YouTube video ID" },
			{ status: 400 },
		);

	const cacheKey = `youtube:${videoId}`;

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
		const pageRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
			headers: {
				"User-Agent":
					"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
			},
		});
		if (!pageRes.ok)
			throw new Error(`Failed to load YouTube page: ${pageRes.status}`);
		const html = await pageRes.text();

		const tracksMatch = html.match(/"captionTracks":(\[[^\]]*\])/);
		if (!tracksMatch) {
			// Video simply has no captions — not an error, just nothing to work with
			await supabase
				.from("episode_transcripts")
				.update({ status: "ready", segments: [] })
				.eq("audio_url", cacheKey);
			return NextResponse.json({
				segments: [],
				warning: "No captions available for this video.",
			});
		}

		const tracks = JSON.parse(tracksMatch[1]);
		const track =
			tracks.find((t: any) => t.languageCode === "en" && t.kind !== "asr") || // prefer human captions
			tracks.find((t: any) => t.languageCode === "en") || // else auto-generated English
			tracks[0]; // else whatever exists

		const captionRes = await fetch(track.baseUrl);
		if (!captionRes.ok)
			throw new Error(`Failed to fetch captions: ${captionRes.status}`);
		const xml = await captionRes.text();

		const segments = [
			...xml.matchAll(
				/<text start="([\d.]+)" dur="([\d.]+)"[^>]*>(.*?)<\/text>/gs,
			),
		].map((m) => ({
			start: parseFloat(m[1]),
			end: parseFloat(m[1]) + parseFloat(m[2]),
			text: decodeHtmlEntities(m[3].replace(/<[^>]+>/g, "")).trim(),
		}));

		await supabase
			.from("episode_transcripts")
			.update({ status: "ready", segments })
			.eq("audio_url", cacheKey);
		return NextResponse.json({ segments });
	} catch (err: any) {
		console.error("YouTube transcript fetch failed:", err.message);
		await supabase
			.from("episode_transcripts")
			.update({ status: "failed" })
			.eq("audio_url", cacheKey);
		return NextResponse.json(
			{ error: "Failed to fetch YouTube transcript" },
			{ status: 500 },
		);
	}
}

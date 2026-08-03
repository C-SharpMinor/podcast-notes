import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { looseRatelimit } from "@/utils/ratelimit";

export async function POST(req: Request) {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user)
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const { success } = await looseRatelimit.limit(user.id);
	if (!success)
		return NextResponse.json(
			{ error: "Too many requests, slow down." },
			{ status: 429 },
		);

	const { query } = await req.json();
	if (!query)
		return NextResponse.json({ error: "query is required" }, { status: 400 });

	try {
		const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=6&q=${encodeURIComponent(
			query + " podcast",
		)}&key=${process.env.YOUTUBE_API_KEY}`;

		const res = await fetch(url);
		if (!res.ok) throw new Error(`YouTube API error: ${res.status}`);
		const data = await res.json();

		const videos = (data.items || []).map((item: any) => ({
			videoId: item.id.videoId,
			title: item.snippet.title,
			channelTitle: item.snippet.channelTitle,
			thumbnail:
				item.snippet.thumbnails?.medium?.url ||
				item.snippet.thumbnails?.default?.url,
			watchUrl: `https://www.youtube.com/watch?v=${item.id.videoId}`,
		}));

		return NextResponse.json({ videos });
	} catch (err: any) {
		console.error("YouTube search failed:", err.message);
		return NextResponse.json(
			{ error: "Failed to search YouTube" },
			{ status: 500 },
		);
	}
}

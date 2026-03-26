import Parser from "rss-parser";
import { NextResponse } from "next/server";

const parser = new Parser();

export async function POST(req: Request) {
	try {
		const { url } = await req.json();

		if (!url) {
			return NextResponse.json({ error: "URL is required" }, { status: 400 });
		}

		let targetUrl = url;

		// Check if the user pasted an Apple Podcasts link
		if (url.includes("podcasts.apple.com")) {
			// Extract the ID from the Apple URL (e.g., id123456789)
			const idMatch = url.match(/id(\d+)/);
			if (idMatch) {
				const appleId = idMatch[1];
				// Ping Apple's free API to get the hidden RSS feed
				const appleRes = await fetch(
					`https://itunes.apple.com/lookup?id=${appleId}`,
				);
				const appleData = await appleRes.json();

				if (appleData.results && appleData.results.length > 0) {
					targetUrl = appleData.results[0].feedUrl;
				} else {
					return NextResponse.json(
						{ error: "Could not resolve Apple Podcast link." },
						{ status: 400 },
					);
				}
			}
		}

		// Now parse the RSS feed (whether they pasted it directly, or we found it via Apple)
		const feed = await parser.parseURL(targetUrl);

		const episodes = feed.items
			.map((item) => ({
				title: item.title,
				pubDate: item.pubDate,
				audioUrl: item.enclosure?.url,
			}))
			.filter((item) => item.audioUrl);

		return NextResponse.json({
			podcastTitle: feed.title,
			episodes,
		});
	} catch (error) {
		console.error("RSS Parsing Error:", error);
		return NextResponse.json(
			{
				error:
					"Failed to parse link. Make sure it is a valid Apple Podcast or RSS link.",
			},
			{ status: 500 },
		);
	}
}

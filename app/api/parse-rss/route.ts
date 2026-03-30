import Parser from "rss-parser";
import { NextResponse } from "next/server";

// Give the parser 20 seconds to accommodate any severe network latency
const parser = new Parser({ timeout: 20000 });

export async function POST(req: Request) {
	try {
		const { url } = await req.json();
		console.log("🟢 1. BACKEND RECEIVED URL:", url);

		if (!url) {
			return NextResponse.json({ error: "URL is required" }, { status: 400 });
		}

		let targetUrl = url;

		if (url.includes("podcasts.apple.com")) {
			const idMatch = url.match(/id(\d+)/);
			if (idMatch) {
				const appleId = idMatch[1];
				console.log(
					"🟢 2. APPLE ID FOUND:",
					appleId,
					"- Asking iTunes for real RSS...",
				);

				const appleRes = await fetch(
					`https://itunes.apple.com/lookup?id=${appleId}`,
				);
				const appleData = await appleRes.json();

				if (appleData.results && appleData.results.length > 0) {
					targetUrl = appleData.results[0].feedUrl;
					console.log("🟢 3. ITUNES SUCCESS! Real RSS is:", targetUrl);
				} else {
					console.log("🔴 3. ITUNES FAILED: No feed found.");
					return NextResponse.json(
						{ error: "Could not resolve Apple Podcast link." },
						{ status: 400 },
					);
				}
			}
		}

		console.log("🟢 4. FETCHING RAW XML AS A BROWSER:", targetUrl);

		// 1. Spoof a real browser to bypass Cloudflare/bot-blockers
		const rssResponse = await fetch(targetUrl, {
			headers: {
				"User-Agent":
					"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
				Accept: "application/rss+xml, application/xml, text/xml, */*",
			},
		});

		if (!rssResponse.ok) {
			throw new Error(`Podcast host rejected request: ${rssResponse.status}`);
		}

		// 2. Download the raw text
		const rssText = await rssResponse.text();
		console.log("🟢 5. XML FETCHED, PARSING STRING...");

		// 3. Feed the raw text into the parser manually
		const feed = await parser.parseString(rssText);
		console.log("🟢 6. PARSER FINISHED SUCCESSFULLY!");
		const episodes =
			feed.items
				?.map((item) => ({
					title: item.title,
					pubDate: item.pubDate,
					audioUrl: item.enclosure?.url,
				}))
				.filter((item) => item.audioUrl) || [];

		return NextResponse.json({
			podcastTitle: feed.title,
			podcastArtwork: feed.itunes?.image || feed.image?.url || "",
			episodes,
		});
	} catch (error: any) {
		console.error("🔴 BACKEND CRASH:", error.message);
		return NextResponse.json(
			{
				error:
					"Failed to parse link. Make sure it is a valid Apple Podcast or RSS link.",
			},
			{ status: 500 },
		);
	}
}

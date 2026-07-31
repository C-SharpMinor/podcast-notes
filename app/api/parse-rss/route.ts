import Parser from "rss-parser";
import { NextResponse } from "next/server";
import dns from "dns/promises";
import { createClient } from "@/utils/supabase/server";
import { looseRatelimit } from "@/utils/ratelimit";

async function isSafeUrl(url: string) {
	const parsed = new URL(url);
	if (!["http:", "https:"].includes(parsed.protocol)) return false;
	const { address } = await dns.lookup(parsed.hostname);
	const priv = /^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/;
	return !priv.test(address) && address !== "::1";
}

const parser = new Parser({ timeout: 20000 });

export async function POST(req: Request) {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const { success } = await looseRatelimit.limit(user.id);
	if (!success) {
		return NextResponse.json(
			{ error: "Too many requests, slow down." },
			{ status: 429 },
		);
	}

	try {
		const { url } = await req.json();
		if (!url) {
			return NextResponse.json({ error: "URL is required" }, { status: 400 });
		}

		if (url.includes("open.spotify.com")) {
			return NextResponse.json(
				{
					error:
						"Spotify links aren't supported — Spotify doesn't publish a public RSS feed for shows. Try searching for the show by name instead, or paste its original RSS feed URL if you have it.",
				},
				{ status: 400 },
			);
		}

		let targetUrl = url;

		if (url.includes("podcasts.apple.com")) {
			const idMatch = url.match(/id(\d+)/);
			if (idMatch) {
				const appleRes = await fetch(
					`https://itunes.apple.com/lookup?id=${idMatch[1]}`,
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

		if (!(await isSafeUrl(targetUrl))) {
			return NextResponse.json(
				{ error: "This URL isn't allowed." },
				{ status: 400 },
			);
		}

		const rssResponse = await fetch(targetUrl, {
			headers: {
				"User-Agent":
					"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
				Accept: "application/rss+xml, application/xml, text/xml, */*",
			},
		});

		if (!rssResponse.ok) {
			return NextResponse.json(
				{
					error: `The link didn't respond correctly (status ${rssResponse.status}). Double check it's a valid feed link.`,
				},
				{ status: 400 },
			);
		}

		const rssText = await rssResponse.text();

		// Fail fast with a clear message instead of letting the XML parser blow up on non-feed content
		const trimmed = rssText.trim();
		const looksLikeFeed =
			trimmed.startsWith("<?xml") ||
			trimmed.includes("<rss") ||
			trimmed.includes("<feed");
		if (!looksLikeFeed) {
			return NextResponse.json(
				{ error: "This link doesn't point to a podcast RSS feed." },
				{ status: 400 },
			);
		}

		let feed;
		try {
			feed = await parser.parseString(rssText);
		} catch (parseErr: any) {
			console.error("XML parse error:", parseErr.message);
			return NextResponse.json(
				{
					error:
						"Could not read this feed. It may be malformed or not a real podcast feed.",
				},
				{ status: 400 },
			);
		}

		const episodes =
			feed.items
				?.map((item) => ({
					title: item.title,
					pubDate: item.pubDate,
					audioUrl: item.enclosure?.url,
					guid: item.guid,
				}))
				.filter((item) => item.audioUrl) || [];

		return NextResponse.json({
			podcastTitle: feed.title,
			podcastArtwork: feed.itunes?.image || feed.image?.url || "",
			episodes,
		});
	} catch (error: any) {
		console.error("RSS parse error:", error.message);
		return NextResponse.json(
			{
				error:
					"Failed to parse link. Make sure it is a valid Apple Podcast or RSS link.",
			},
			{ status: 500 },
		);
	}
}

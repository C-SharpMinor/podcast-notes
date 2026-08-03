"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { useToast } from "@/components/Toast";

const GENRE_OPTIONS = [
	"Technology",
	"Business",
	"True Crime",
	"Comedy",
	"News & Politics",
	"Health & Fitness",
	"Education",
	"Sports",
	"Music",
	"Science",
	"History",
	"Arts & Culture",
	"Society & Culture",
	"Self-Improvement",
];

interface PodcastResult {
	collectionId: number;
	collectionName: string;
	artistName: string;
	artworkUrl600?: string;
	artworkUrl100?: string;
	feedUrl?: string;
}

export default function SuggestionsPage() {
	const [userId, setUserId] = useState("");
	const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
	const [results, setResults] = useState<PodcastResult[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [isSearching, setIsSearching] = useState(false);
	const [videos, setVideos] = useState<any[]>([]);
	const { showToast } = useToast();
	const supabase = createClient();

	useEffect(() => {
		const load = async () => {
			const {
				data: { user },
			} = await supabase.auth.getUser();
			if (!user) return;
			setUserId(user.id);

			const { data: profile } = await supabase
				.from("profiles")
				.select("preferred_genres")
				.eq("id", user.id)
				.maybeSingle();
			const genres = profile?.preferred_genres || [];
			setSelectedGenres(genres);
			setIsLoading(false);
			if (genres.length > 0) fetchSuggestions(genres);
		};
		load();
	}, []);

	const toggleGenre = (genre: string) => {
		setSelectedGenres((prev) =>
			prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre],
		);
	};

	const fetchSuggestions = async (genres: string[]) => {
		if (genres.length === 0) {
			setResults([]);
			return;
		}
		setIsSearching(true);
		try {
			const queries = genres
				.slice(0, 4)
				.map((g) =>
					fetch(
						`https://itunes.apple.com/search?term=${encodeURIComponent(g)}&entity=podcast&limit=6`,
					).then((r) => r.json()),
				);
			const responses = await Promise.all(queries);
			const combined = responses.flatMap((r) => r.results || []);
			const deduped = Array.from(
				new Map(combined.map((p: any) => [p.collectionId, p])).values(),
			);
			setResults(deduped as PodcastResult[]);

			const videoRes = await fetch("/api/search-youtube", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ query: genres[0] }),
			}).then((r) => r.json());
			setVideos(videoRes.videos || []);
		} catch {
			showToast("Couldn't load suggestions right now.", "error");
		} finally {
			setIsSearching(false);
		}
	};

	const savePreferencesAndSearch = async () => {
		if (userId) {
			await supabase.from("profiles").upsert({
				id: userId,
				preferred_genres: selectedGenres,
				updated_at: new Date().toISOString(),
			});
		}
		fetchSuggestions(selectedGenres);
	};

	return (
		<div className="max-w-3xl mx-auto px-4 py-10">
			<h1 className="text-2xl font-semibold tracking-tight text-[var(--text)] mb-2">
				Discover
			</h1>
			<p className="text-sm text-[var(--text-muted)] mb-6">
				Pick a few genres and we'll suggest podcasts to try. Adjust these
				anytime here or in Account.
			</p>

			{isLoading ? (
				<div className="h-10 rounded-full bg-[var(--surface-hover)] animate-pulse mb-8 w-2/3" />
			) : (
				<>
					<div className="flex flex-wrap gap-2 mb-4">
						{GENRE_OPTIONS.map((genre) => {
							const selected = selectedGenres.includes(genre);
							return (
								<button
									key={genre}
									onClick={() => toggleGenre(genre)}
									className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${selected ? "bg-[var(--accent)] border-[var(--accent)] text-white" : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--accent)]/50"}`}
								>
									{genre}
								</button>
							);
						})}
					</div>
					<button
						onClick={savePreferencesAndSearch}
						disabled={isSearching || selectedGenres.length === 0}
						className="text-sm font-medium text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)] px-4 py-2 rounded-xl transition-colors disabled:opacity-40 mb-8"
					>
						{isSearching ? "Finding shows…" : "Show suggestions"}
					</button>
				</>
			)}

			{isSearching && (
				<div className="grid grid-cols-2 sm:grid-cols-3 gap-4 animate-pulse">
					{[...Array(6)].map((_, i) => (
						<div
							key={i}
							className="aspect-square rounded-2xl bg-[var(--surface-hover)]"
						/>
					))}
				</div>
			)}

			{!isSearching && results.length > 0 && (
				<div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
					{results.map((podcast) => (
						<Link
							key={podcast.collectionId}
							href={`/?feed=${encodeURIComponent(podcast.feedUrl || "")}`}
							className="group text-left"
						>
							<div className="aspect-square rounded-2xl overflow-hidden border border-[var(--border)] shadow-sm mb-2 bg-[var(--surface)]">
								{/* eslint-disable-next-line @next/next/no-img-element */}
								<img
									src={podcast.artworkUrl600 || podcast.artworkUrl100}
									alt=""
									className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
								/>
							</div>
							<p className="text-sm font-medium text-[var(--text)] truncate">
								{podcast.collectionName}
							</p>
							<p className="text-xs text-[var(--text-muted)] truncate">
								{podcast.artistName}
							</p>
						</Link>
					))}
				</div>
			)}

			{videos.length > 0 && (
				<div className="mt-10">
					<h2 className="text-sm font-semibold text-[var(--text-muted)] mb-4">
						From YouTube
					</h2>
					<div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
						{videos.map((v) => (
							<Link
								key={v.videoId}
								href={`/?video=${encodeURIComponent(v.watchUrl)}&title=${encodeURIComponent(v.title)}`}
								className="group text-left"
							>
								<div className="aspect-video rounded-2xl overflow-hidden border border-[var(--border)] shadow-sm mb-2 bg-[var(--surface)]">
									{/* eslint-disable-next-line @next/next/no-img-element */}
									<img
										src={v.thumbnail}
										alt=""
										className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
									/>
								</div>
								<p className="text-sm font-medium text-[var(--text)] truncate">
									{v.title}
								</p>
								<p className="text-xs text-[var(--text-muted)] truncate">
									{v.channelTitle}
								</p>
							</Link>
						))}
					</div>
				</div>
			)}

			{!isSearching &&
				selectedGenres.length > 0 &&
				results.length === 0 &&
				!isLoading && (
					<p className="text-sm text-[var(--text-muted)] italic">
						No suggestions found — try different genres.
					</p>
				)}
		</div>
	);
}

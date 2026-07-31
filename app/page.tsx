"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AudioPlayer from "@/components/AudioPlayer";
import Auth from "@/components/Auth";
import UploadEpisode from "@/components/UploadEpisode";
import SourceInput from "@/components/SourceInput";
import ThemeToggle from "@/components/ThemeToggle";
import ChoiceModal from "@/components/ChoiceModal";
import { createClient } from "@/utils/supabase/client";
import { useToast } from "@/components/Toast";

interface Episode {
	title: string;
	pubDate: string;
	audioUrl: string;
}

type SourceType = "rss" | "youtube" | "upload";

export default function Home() {
	const [podcastArtwork, setPodcastArtwork] = useState("");
	const [session, setSession] = useState<any>(null);
	const [loading, setLoading] = useState(false);
	const [episodes, setEpisodes] = useState<Episode[]>([]);
	const [podcastTitle, setPodcastTitle] = useState("");
	const [selectedEpisode, setSelectedEpisode] = useState<Episode | null>(null);
	const [selectedSourceType, setSelectedSourceType] =
		useState<SourceType>("rss");
	const [selectedStoragePath, setSelectedStoragePath] = useState<
		string | undefined
	>(undefined);
	const [showChoiceModal, setShowChoiceModal] = useState(false);
	const [pendingPodcast, setPendingPodcast] = useState<any>(null);
	const [searchResults, setSearchResults] = useState<any[]>([]);
	const [isSearching, setIsSearching] = useState(false);

	const supabase = createClient();
	const { showToast } = useToast();

	useEffect(() => {
		supabase.auth
			.getSession()
			.then(({ data: { session } }) => setSession(session));
		const {
			data: { subscription },
		} = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
		return () => subscription.unsubscribe();
	}, []);

	const handleLogout = async () => {
		await supabase.auth.signOut();
	};

	const fetchPodcast = async (
		urlToFetch: string,
		isBackgroundLoad: boolean = false,
		autoSelectTitle?: string,
	) => {
		if (!urlToFetch) return;
		if (!isBackgroundLoad) setLoading(true);
		setSearchResults([]);

		try {
			if (
				urlToFetch.includes("youtube.com") ||
				urlToFetch.includes("youtu.be")
			) {
				setSelectedEpisode({
					title: "YouTube Video",
					pubDate: new Date().toISOString(),
					audioUrl: urlToFetch,
				});
				setSelectedSourceType("youtube");
				setSelectedStoragePath(undefined);
				setEpisodes([]);
				setPodcastTitle("");
				setLoading(false);
				return;
			}

			const res = await fetch("/api/parse-rss", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ url: urlToFetch }),
			});
			const data = await res.json();
			if (data.error) throw new Error(data.error);

			setPodcastTitle(data.podcastTitle);
			setEpisodes(data.episodes);
			setPodcastArtwork(data.podcastArtwork || "");

			if (autoSelectTitle) {
				const foundEp = data.episodes.find(
					(ep: Episode) => ep.title === autoSelectTitle,
				);
				if (foundEp) {
					setSelectedEpisode(foundEp);
					setSelectedSourceType("rss");
					setSelectedStoragePath(undefined);
				}
			} else if (!isBackgroundLoad) {
				setSelectedEpisode(null);
			}
		} catch (err: any) {
			if (!isBackgroundLoad) showToast(err.message, "error");
		} finally {
			if (!isBackgroundLoad) setLoading(false);
		}
	};

	const handleSearch = async (query: string) => {
		setIsSearching(true);
		setSearchResults([]);
		try {
			const res = await fetch(
				`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=podcastEpisode&limit=6`,
			);
			const data = await res.json();
			setSearchResults(data.results || []);
			if (!data.results?.length)
				showToast("No episodes found for that search.", "info");
		} catch {
			showToast("Failed to search episodes.", "error");
		} finally {
			setIsSearching(false);
		}
	};

	const handleSelectSearchResult = (data: any) => {
		setSearchResults([]);
		setPodcastArtwork(data.artworkUrl600 || data.artworkUrl100 || "");

		const hasAudio = !!(data.episodeUrl || data.previewUrl);
		if (hasAudio) {
			setPendingPodcast(data);
			setShowChoiceModal(true);
		} else {
			const feedUrl = data.feedUrl || "";
			if (feedUrl) fetchPodcast(feedUrl);
			else showToast("This podcast doesn't have a valid feed.", "error");
		}
	};

	const confirmChoice = (choice: "play" | "list") => {
		if (!pendingPodcast) return;
		const feedUrl = pendingPodcast.feedUrl || "";

		if (choice === "play") {
			setSelectedEpisode({
				title: pendingPodcast.trackName || pendingPodcast.collectionName,
				pubDate: pendingPodcast.releaseDate || new Date().toISOString(),
				audioUrl: pendingPodcast.episodeUrl || pendingPodcast.previewUrl,
			});
			setSelectedSourceType("rss");
			setSelectedStoragePath(undefined);
			setPodcastTitle(pendingPodcast.collectionName);
			if (feedUrl)
				fetchPodcast(
					feedUrl,
					true,
					pendingPodcast.trackName || pendingPodcast.collectionName,
				);
		} else {
			fetchPodcast(feedUrl);
		}

		setShowChoiceModal(false);
		setPendingPodcast(null);
	};

	const handleUploadComplete = (upload: {
		audioUrl: string;
		storagePath: string;
		title: string;
	}) => {
		setSelectedEpisode({
			title: upload.title,
			pubDate: new Date().toISOString(),
			audioUrl: upload.audioUrl,
		});
		setSelectedSourceType("upload");
		setSelectedStoragePath(upload.storagePath);
		setEpisodes([]);
		setPodcastTitle("");
		setPodcastArtwork("");
	};

	if (!session) {
		return <Auth onLogin={() => {}} />;
	}

	return (
		<main className="min-h-screen bg-[var(--bg)]">
			<header className="max-w-3xl mx-auto flex items-center justify-between px-4 py-5 border-b border-[var(--border)]">
				<div className="text-sm text-[var(--text-muted)] truncate max-w-[160px] sm:max-w-none">
					<span className="text-[var(--text)] font-medium">
						{session.user.email}
					</span>
				</div>
				<div className="flex items-center gap-3">
					<Link
						href="/notebook"
						className="text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
					>
						My Notebook
					</Link>
					<ThemeToggle />
					<button
						onClick={handleLogout}
						className="text-sm font-medium text-[var(--danger)] hover:opacity-80 transition-opacity"
					>
						Sign out
					</button>
				</div>
			</header>

			<div className="max-w-2xl mx-auto text-center px-4 pt-16 pb-20">
				<h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-[var(--text)] mb-3">
					Voice-activated notes
				</h1>
				<p className="text-[var(--text-muted)] mb-10 text-base leading-relaxed">
					Search a podcast, play an episode, and press{" "}
					<span className="text-[var(--accent)] font-mono font-medium bg-[var(--accent-soft)] px-2 py-0.5 rounded-md">
						hold
					</span>{" "}
					to take a note.
				</p>

				<SourceInput
					onSubmitLink={(url) => fetchPodcast(url)}
					onSearch={handleSearch}
					isLoading={loading}
					isSearching={isSearching}
				/>

				{searchResults.length > 0 && (
					<div className="max-w-md mx-auto mt-4 bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-sm overflow-hidden text-left divide-y divide-[var(--border)]">
						{searchResults.map((podcast) => (
							<button
								key={podcast.trackId || podcast.collectionId}
								onClick={() => handleSelectSearchResult(podcast)}
								className="w-full flex items-center gap-3 p-3.5 hover:bg-[var(--surface-hover)] transition-colors text-left"
							>
								{/* eslint-disable-next-line @next/next/no-img-element */}
								<img
									src={podcast.artworkUrl60}
									alt=""
									className="w-11 h-11 rounded-xl shadow-sm"
								/>
								<div className="flex-1 overflow-hidden">
									<div className="font-medium text-sm text-[var(--text)] truncate">
										{podcast.collectionName}
									</div>
									<div className="text-xs text-[var(--text-muted)] truncate">
										{podcast.artistName}
									</div>
								</div>
							</button>
						))}
					</div>
				)}

				<div className="flex items-center gap-3 max-w-md mx-auto my-8">
					<div className="flex-1 h-px bg-[var(--border)]" />
					<span className="text-xs text-[var(--text-muted)]">or</span>
					<div className="flex-1 h-px bg-[var(--border)]" />
				</div>

				<UploadEpisode
					userId={session.user.id}
					onUploaded={handleUploadComplete}
				/>

				{podcastArtwork && (
					<div className="flex justify-center my-10 animate-in fade-in zoom-in duration-500">
						<div className="relative">
							<div className="absolute -inset-2 bg-[var(--accent)]/20 rounded-[2.5rem] blur-2xl" />
							<div className="relative w-56 h-56 sm:w-64 sm:h-64 overflow-hidden rounded-[1.75rem] shadow-lg border border-[var(--border)] bg-[var(--surface)]">
								{/* eslint-disable-next-line @next/next/no-img-element */}
								<img
									src={podcastArtwork}
									alt={podcastTitle || "Podcast artwork"}
									className="w-full h-full object-cover"
								/>
							</div>
						</div>
					</div>
				)}

				{loading && (
					<div className="max-w-md mx-auto mt-6 space-y-2 animate-pulse">
						{[...Array(4)].map((_, i) => (
							<div
								key={i}
								className="h-11 rounded-xl bg-[var(--surface-hover)]"
							/>
						))}
					</div>
				)}

				{episodes.length > 0 && !selectedEpisode && !loading && (
					<div className="max-w-md mx-auto bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-2 max-h-80 overflow-y-auto mb-8 text-left shadow-sm">
						<h3 className="text-sm font-semibold text-[var(--text)] px-3 py-2.5 sticky top-0 bg-[var(--surface)] border-b border-[var(--border)]">
							{podcastTitle}
						</h3>
						<ul className="py-1">
							{episodes.map((ep, idx) => (
								<li key={idx}>
									<button
										onClick={() => {
											setSelectedEpisode(ep);
											setSelectedSourceType("rss");
											setSelectedStoragePath(undefined);
										}}
										className="w-full text-left text-sm text-[var(--text)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)] px-3 py-2.5 rounded-xl transition-colors"
									>
										{ep.title}
									</button>
								</li>
							))}
						</ul>
					</div>
				)}

				{selectedEpisode && (
					<div className="animate-in fade-in slide-in-from-bottom-4 duration-500 mt-4">
						<AudioPlayer
							audioUrl={selectedEpisode.audioUrl}
							episodeTitle={selectedEpisode.title}
							userId={session.user.id}
							sourceType={selectedSourceType}
							storagePath={selectedStoragePath}
						/>
					</div>
				)}
			</div>

			<ChoiceModal
				isOpen={showChoiceModal}
				onClose={() => setShowChoiceModal(false)}
				onConfirm={confirmChoice}
				podcastData={pendingPodcast}
			/>
		</main>
	);
}

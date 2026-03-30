"use client";

import { useEffect, useState } from "react";
import AudioPlayer from "@/components/AudioPlayer";
import Auth from "@/components/Auth";
import { createClient } from "@/utils/supabase/client";
import ChoiceModal from "@/components/ChoiceModal";

interface Episode {
	title: string;
	pubDate: string;
	audioUrl: string;
}

export default function Home() {
	const [podcastArtwork, setPodcastArtwork] = useState("");
	const [session, setSession] = useState<any>(null);
	const [rssUrl, setRssUrl] = useState("");
	const [loading, setLoading] = useState(false);
	const [episodes, setEpisodes] = useState<Episode[]>([]);
	const [podcastTitle, setPodcastTitle] = useState("");
	const [selectedEpisode, setSelectedEpisode] = useState<Episode | null>(null);
	const [showChoiceModal, setShowChoiceModal] = useState(false);
	const [pendingPodcast, setPendingPodcast] = useState<any>(null);

	// --- NEW: Search State ---
	const [searchQuery, setSearchQuery] = useState("");
	const [searchResults, setSearchResults] = useState<any[]>([]);
	const [isSearching, setIsSearching] = useState(false);
	const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);

	const supabase = createClient();

	useEffect(() => {
		supabase.auth.getSession().then(({ data: { session } }) => {
			setSession(session);
		});

		const {
			data: { subscription },
		} = supabase.auth.onAuthStateChange((_event, session) => {
			setSession(session);
		});

		return () => subscription.unsubscribe();
	}, []);

	const handleLogout = async () => {
		await supabase.auth.signOut();
	};

	// --- UPDATED: Accepts a direct URL parameter so the Search function can use it ---
	// --- UPDATED: Now supports background loading and auto-selecting ---
	const fetchPodcast = async (
		urlToFetch: string = rssUrl,
		isBackgroundLoad: boolean = false,
		autoSelectTitle?: string,
	) => {
		if (!urlToFetch) return;

		// Only show the loading spinner if this is a manual, foreground request
		if (!isBackgroundLoad) setLoading(true);

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

			// If we are looking for a specific episode, find it and select it
			if (autoSelectTitle) {
				const foundEp = data.episodes.find(
					(ep: Episode) => ep.title === autoSelectTitle,
				);
				if (foundEp) setSelectedEpisode(foundEp);
			} else if (!isBackgroundLoad) {
				// Only clear the player if this was a manual link paste
				setSelectedEpisode(null);
			}
		} catch (err: any) {
			if (!isBackgroundLoad) alert(err.message);
		} finally {
			if (!isBackgroundLoad) setLoading(false);
		}
	};

	// --- NEW: iTunes Search Logic ---
	// --- UPDATED: iTunes Search Logic for EPISODES ---
	const handleSearch = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!searchQuery.trim()) return;

		setIsSearching(true);
		setSearchResults([]);

		try {
			// Changed entity to 'podcastEpisode'
			const res = await fetch(
				`https://itunes.apple.com/search?term=${encodeURIComponent(searchQuery)}&entity=podcastEpisode&limit=5`,
			);
			const data = await res.json();
			setSearchResults(data.results || []);
		} catch (err: any) {
			alert("Failed to search episodes.");
		} finally {
			setIsSearching(false);
		}
	};

	const handleSelectSearchResult = (data: any) => {
		setSearchResults([]);
		setIsMobileSearchOpen(false);
		setPodcastArtwork(data.artworkUrl600 || data.artworkUrl100 || "");

		// Check if iTunes gave us an actual audio file link (episodeUrl)
		const hasAudio = !!(data.episodeUrl || data.previewUrl);

		if (hasAudio) {
			setPendingPodcast(data);
			setShowChoiceModal(true);
		} else {
			// It's a Show/Collection, just load the list
			const feedUrl = data.feedUrl || "";
			if (feedUrl) {
				setRssUrl(feedUrl);
				fetchPodcast(feedUrl);
			} else {
				alert("This podcast doesn't have a valid feed.");
			}
		}
	};

	const confirmChoice = (choice: "play" | "list") => {
		if (!pendingPodcast) return;

		const feedUrl = pendingPodcast.feedUrl || "";
		setRssUrl(feedUrl);

		if (choice === "play") {
			setSelectedEpisode({
				// Episodes use trackName, Shows use collectionName
				title: pendingPodcast.trackName || pendingPodcast.collectionName,
				pubDate: pendingPodcast.releaseDate || new Date().toISOString(),
				audioUrl: pendingPodcast.episodeUrl || pendingPodcast.previewUrl,
			});
			setPodcastTitle(pendingPodcast.collectionName);
			if (feedUrl) fetchPodcast(feedUrl, true);
		} else {
			fetchPodcast(feedUrl);
		}

		setShowChoiceModal(false);
		setPendingPodcast(null);
	};

	if (!session) {
		return (
			<main className="min-h-screen bg-slate-950 p-4">
				<Auth onLogin={() => {}} />
			</main>
		);
	}

	return (
		<main className="min-h-screen bg-slate-950 p-4 font-sans">
			{/* --- THE NEW RESPONSIVE HEADER --- */}
			<header className="max-w-4xl mx-auto flex items-center justify-between py-4 border-b border-slate-800 mb-12 relative">
				{/* Left Side: Logo/Email (Hides on mobile when search is open) */}
				<div className={`text-sm ${isMobileSearchOpen ? "hidden" : "block"}`}>
					<span className="text-gray-400">Logged in as </span>
					<span className="text-white font-mono truncate max-w-[150px] inline-block align-bottom">
						{session.user.email}
					</span>
				</div>

				{/* Right Side Controls */}
				<div
					className={`flex items-center gap-4 ${isMobileSearchOpen ? "w-full" : ""}`}
				>
					{/* The Search Bar Form */}
					<form
						onSubmit={handleSearch}
						className={`relative ${isMobileSearchOpen ? "flex w-full" : "hidden md:flex"} items-center`}
					>
						{/* Mobile Back Button */}
						{isMobileSearchOpen && (
							<button
								type="button"
								onClick={() => setIsMobileSearchOpen(false)}
								className="mr-2 text-gray-400 hover:text-white"
							>
								<svg
									className="w-6 h-6"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth="2"
										d="M15 19l-7-7 7-7"
									></path>
								</svg>
							</button>
						)}

						<div className="relative w-full md:w-64 lg:w-80">
							<input
								type="text"
								placeholder="Search podcasts..."
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								className="w-full bg-slate-900 border border-slate-700 text-white rounded-full py-2 pl-4 pr-10 focus:outline-none focus:border-blue-500 transition"
							/>
							<button
								type="submit"
								className="absolute right-3 top-2.5 text-gray-400 hover:text-white"
							>
								{isSearching ? (
									<svg
										className="animate-spin h-5 w-5"
										xmlns="http://www.w3.org/2000/svg"
										fill="none"
										viewBox="0 0 24 24"
									>
										<circle
											className="opacity-25"
											cx="12"
											cy="12"
											r="10"
											stroke="currentColor"
											strokeWidth="4"
										></circle>
										<path
											className="opacity-75"
											fill="currentColor"
											d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
										></path>
									</svg>
								) : (
									<svg
										className="w-5 h-5"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
									>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth="2"
											d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
										></path>
									</svg>
								)}
							</button>
						</div>

						{/* Floating Search Results Dropdown */}
						{searchResults.length > 0 && (
							<div className="absolute top-12 left-0 right-0 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden">
								<div className="flex justify-between items-center p-2 bg-slate-900 border-b border-slate-700">
									<span className="text-xs text-gray-400 font-bold ml-2 uppercase">
										Results
									</span>
									<button
										type="button"
										onClick={() => setSearchResults([])}
										className="text-gray-400 hover:text-white p-1"
									>
										<svg
											className="w-4 h-4"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24"
										>
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												strokeWidth="2"
												d="M6 18L18 6M6 6l12 12"
											></path>
										</svg>
									</button>
								</div>
								{searchResults.map((podcast) => (
									<button
										key={podcast.trackId || podcast.collectionId}
										type="button"
										onClick={() => handleSelectSearchResult(podcast)}
										className="w-full flex items-center gap-3 p-3 hover:bg-slate-700 transition text-left border-b border-slate-700/50 last:border-0"
									>
										{/* eslint-disable-next-line @next/next/no-img-element */}
										<img
											src={podcast.artworkUrl60}
											alt="cover"
											className="w-10 h-10 rounded shadow-sm"
										/>
										<div className="flex-1 overflow-hidden">
											<div className="font-bold text-sm text-white truncate">
												{podcast.collectionName}
											</div>
											<div className="text-xs text-gray-400 truncate">
												{podcast.artistName}
											</div>
										</div>
									</button>
								))}
							</div>
						)}
					</form>

					{/* Mobile Search Icon Toggle (Hides when search is open or on desktop) */}
					{!isMobileSearchOpen && (
						<button
							onClick={() => setIsMobileSearchOpen(true)}
							className="md:hidden text-gray-400 hover:text-white p-2 bg-slate-900 rounded-full border border-slate-700"
						>
							<svg
								className="w-5 h-5"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth="2"
									d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
								></path>
							</svg>
						</button>
					)}

					{/* Sign Out Button (Hides on mobile when search is open) */}
					<button
						onClick={handleLogout}
						className={`text-sm text-red-400 hover:text-red-300 font-medium ${isMobileSearchOpen ? "hidden" : "block"}`}
					>
						Sign Out
					</button>
				</div>
			</header>

			{/* --- MAIN CONTENT AREA --- */}
			<div className="max-w-2xl mx-auto text-center mt-8">
				<h1 className="text-4xl font-extrabold text-white mb-3 tracking-tight">
					Voice-Activated Notes
				</h1>
				<p className="text-gray-400 mb-10 text-lg">
					Search for a podcast, play an episode, and press{" "}
					<span className="text-blue-400 font-mono font-bold bg-blue-900/30 px-2 py-1 rounded">
						Hold
					</span>{" "}
					to take a note.
				</p>

				{/* Manual Link Input (Still here as a fallback/alternative) */}
				<div className="flex gap-2 mb-10 max-w-md mx-auto">
					<input
						type="text"
						placeholder="Or paste a YouTube or RSS link..."
						// The || "" ensures that even if rssUrl is null or undefined,
						// the input stays "controlled" with an empty string.
						value={rssUrl || ""}
						onChange={(e) => setRssUrl(e.target.value)}
						className="flex-1 bg-slate-900 text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 border border-slate-800"
					/>
					<button
						onClick={() => fetchPodcast()}
						disabled={loading}
						className="flex items-center justify-center bg-blue-600 hover:bg-blue-500 px-6 py-3 rounded-lg font-bold transition disabled:opacity-50 min-w-[100px]"
					>
						{loading ? "..." : "Load"}
					</button>
				</div>

				{/* --- BIG IMAGE BOX --- */}
				{podcastArtwork && (
					<div className="flex justify-center mb-10 animate-in fade-in zoom-in duration-500">
						<div className="relative group">
							{/* Glow Effect behind the image */}
							<div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-purple-600 rounded-[2.5rem] blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>

							<div className="relative w-64 h-64 md:w-80 md:h-80 overflow-hidden rounded-[2rem] shadow-2xl border border-slate-800 bg-slate-900">
								{/* eslint-disable-next-line @next/next/no-img-element */}
								<img
									src={podcastArtwork}
									alt={podcastTitle || "Podcast Artwork"}
									className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
								/>
							</div>
						</div>
					</div>
				)}

				{/* Episode Selector */}
				{episodes.length > 0 && !selectedEpisode && (
					<div className="max-w-md mx-auto bg-slate-900/50 backdrop-blur-sm rounded-xl p-4 max-h-80 overflow-y-auto mb-8 text-left border border-slate-800 shadow-xl">
						<h3 className="text-lg font-bold text-white mb-4 sticky top-0 bg-slate-900 py-2 border-b border-slate-800">
							{podcastTitle}
						</h3>
						<ul className="space-y-1">
							{episodes.map((ep, idx) => (
								<li key={idx}>
									<button
										onClick={() => setSelectedEpisode(ep)}
										className="w-full text-left text-sm text-gray-300 hover:text-white hover:bg-blue-900/40 p-3 rounded-lg transition"
									>
										{ep.title}
									</button>
								</li>
							))}
						</ul>
					</div>
				)}

				{/* The Audio/Video Player */}
				{selectedEpisode && (
					<div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
						<AudioPlayer
							audioUrl={selectedEpisode.audioUrl}
							episodeTitle={selectedEpisode.title}
							userId={session.user.id}
						/>
					</div>
				)}
			</div>
			{/* CHOICE MODAL */}
			<ChoiceModal
				isOpen={showChoiceModal}
				onClose={() => setShowChoiceModal(false)}
				onConfirm={confirmChoice}
				podcastData={pendingPodcast}
			/>
		</main>
	);
}

"use client";

import { useEffect, useState } from "react";
import AudioPlayer from "@/components/AudioPlayer";
import Auth from "@/components/Auth";
import { createClient } from "@/utils/supabase/client";

interface Episode {
	title: string;
	pubDate: string;
	audioUrl: string;
}

export default function Home() {
	const [session, setSession] = useState<any>(null);
	const [rssUrl, setRssUrl] = useState("");
	const [loading, setLoading] = useState(false);
	const [episodes, setEpisodes] = useState<Episode[]>([]);
	const [podcastTitle, setPodcastTitle] = useState("");
	const [selectedEpisode, setSelectedEpisode] = useState<Episode | null>(null);

	const supabase = createClient();

	// Check if user is logged in on load
	useEffect(() => {
		supabase.auth.getSession().then(({ data: { session } }) => {
			setSession(session);
		});

		// Listen for login/logout events
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

	const fetchPodcast = async () => {
		if (!rssUrl) return;
		setLoading(true);

		try {
			const res = await fetch("/api/parse-rss", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ url: rssUrl }),
			});

			const data = await res.json();
			if (data.error) throw new Error(data.error);

			setPodcastTitle(data.podcastTitle);
			setEpisodes(data.episodes);
		} catch (err: any) {
			alert(err.message);
		} finally {
			setLoading(false);
		}
	};

	// If there is no session, show the login screen
	if (!session) {
		return (
			<main className="min-h-screen bg-slate-950 p-4">
				<Auth onLogin={() => {}} />
			</main>
		);
	}

	return (
		<main className="min-h-screen bg-slate-950 p-4">
			{/* Top Navigation Bar */}
			<div className="max-w-2xl mx-auto flex justify-between items-center py-4 border-b border-slate-800 mb-8">
				<div className="text-gray-400 text-sm">
					Logged in as{" "}
					<span className="text-white font-mono">{session.user.email}</span>
				</div>
				<button
					onClick={handleLogout}
					className="text-sm text-red-400 hover:text-red-300"
				>
					Sign Out
				</button>
			</div>

			<div className="max-w-2xl mx-auto text-center">
				<h1 className="text-4xl font-extrabold text-white mb-2">
					Voice-Activated Notes
				</h1>
				<p className="text-gray-400 mb-8">
					Paste an RSS feed, play an episode, and say{" "}
					<span className="text-blue-400 font-mono">"note that"</span>.
				</p>

				{/* RSS / Apple Link Input Area */}
				<div className="flex gap-2 mb-8 max-w-md mx-auto">
					<input
						type="text"
						placeholder="Paste Apple Podcast or RSS link..."
						value={rssUrl}
						onChange={(e) => setRssUrl(e.target.value)}
						className="flex-1 bg-slate-800 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
					/>
					<button
						onClick={fetchPodcast}
						disabled={loading}
						className="flex items-center justify-center bg-blue-600 hover:bg-blue-500 px-6 py-2 rounded-lg font-semibold transition disabled:opacity-50 min-w-[100px]"
					>
						{loading ? (
							<svg
								className="animate-spin h-5 w-5 text-white"
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
							"Load"
						)}
					</button>
				</div>

				{/* Episode Selector */}
				{episodes.length > 0 && !selectedEpisode && (
					<div className="max-w-md mx-auto bg-slate-900 rounded-xl p-4 max-h-64 overflow-y-auto mb-8 text-left border border-slate-700">
						<h3 className="text-lg font-bold text-white mb-3">
							{podcastTitle}
						</h3>
						<ul className="space-y-2">
							{episodes.map((ep, idx) => (
								<li key={idx}>
									<button
										onClick={() => setSelectedEpisode(ep)}
										className="w-full text-left text-sm text-gray-300 hover:text-white hover:bg-slate-800 p-2 rounded transition"
									>
										{ep.title}
									</button>
								</li>
							))}
						</ul>
					</div>
				)}

				{/* The Audio Player */}
				<AudioPlayer
					audioUrl={selectedEpisode?.audioUrl}
					episodeTitle={selectedEpisode?.title}
					userId={session.user.id}
				/>
			</div>
		</main>
	);
}

"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { usePlayer } from "@/contexts/PlayerContext";

interface HistoryItem {
	id: string;
	episode_title: string;
	audio_url: string;
	source_type: "rss" | "youtube" | "upload";
	storage_path: string | null;
	artwork_url: string | null;
	duration_seconds: number | null;
	last_position_seconds: number;
}

export default function RecentListeningsCard() {
	const [items, setItems] = useState<HistoryItem[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const { playTrack } = usePlayer();

	useEffect(() => {
		const load = async () => {
			const supabase = createClient();
			const { data, error } = await supabase
				.from("listening_history")
				.select("*")
				.order("last_listened_at", { ascending: false })
				.limit(6);
			if (!error && data) setItems(data as HistoryItem[]);
			setIsLoading(false);
		};
		load();
	}, []);

	const handleContinue = (item: HistoryItem) => {
		playTrack(
			{
				audioUrl: item.audio_url,
				episodeTitle: item.episode_title,
				sourceType: item.source_type,
				storagePath: item.storage_path || undefined,
				artworkUrl: item.artwork_url || undefined,
				durationSeconds: item.duration_seconds,
			},
			item.last_position_seconds,
		);
	};

	if (isLoading) {
		return (
			<div className="space-y-2 animate-pulse mb-10">
				{[...Array(2)].map((_, i) => (
					<div key={i} className="h-16 rounded-xl bg-[var(--surface-hover)]" />
				))}
			</div>
		);
	}

	if (items.length === 0) return null;

	return (
		<div className="mb-10 text-left">
			<h2 className="text-sm font-semibold text-[var(--text-muted)] mb-3">
				Recent listening
			</h2>
			<ul className="space-y-2">
				{items.map((item) => (
					<li
						key={item.id}
						className="flex items-center gap-3 bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3 shadow-sm"
					>
						<div className="w-12 h-12 rounded-lg overflow-hidden bg-[var(--bg)] border border-[var(--border)] shrink-0 flex items-center justify-center">
							{item.artwork_url ? (
								// eslint-disable-next-line @next/next/no-img-element
								<img
									src={item.artwork_url}
									alt=""
									className="w-full h-full object-cover"
								/>
							) : (
								<span className="text-[var(--text-muted)] text-xs">♪</span>
							)}
						</div>
						<div className="flex-1 min-w-0">
							<p className="text-sm font-medium text-[var(--text)] truncate">
								{item.episode_title}
							</p>
							<p className="text-xs text-[var(--text-muted)]">
								{item.duration_seconds
									? `${Math.floor(item.duration_seconds / 60)} min · `
									: ""}
								left off at {Math.floor(item.last_position_seconds / 60)}:
								{(item.last_position_seconds % 60).toString().padStart(2, "0")}
							</p>
						</div>
						<button
							onClick={() => handleContinue(item)}
							className="text-xs font-medium text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)] px-3 py-1.5 rounded-lg transition-colors shrink-0"
						>
							Continue
						</button>
					</li>
				))}
			</ul>
		</div>
	);
}

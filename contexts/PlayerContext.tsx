"use client";

import {
	createContext,
	useContext,
	useState,
	useCallback,
	useRef,
} from "react";
import { createClient } from "@/utils/supabase/client";

export interface Track {
	audioUrl: string;
	episodeTitle: string;
	sourceType: "rss" | "youtube" | "upload";
	storagePath?: string;
	artworkUrl?: string;
	durationSeconds?: number | null;
	sourceMeta?: {
		sourceUrl: string;
		sourceTitle: string;
		authorName?: string;
	} | null;
	episodeId?: string | null;
}

interface PlayerContextValue {
	track: Track | null;
	isPlaying: boolean;
	currentTime: number;
	duration: number;
	seekTarget: number | null;
	playTrack: (track: Track, resumeAt?: number) => void;
	togglePlay: () => void;
	seekTo: (seconds: number) => void;
	clearSeekTarget: () => void;
	setPlaying: (playing: boolean) => void;
	reportProgress: (seconds: number) => void;
	setDuration: (seconds: number) => void;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function usePlayer() {
	const ctx = useContext(PlayerContext);
	if (!ctx) throw new Error("usePlayer must be used within PlayerProvider");
	return ctx;
}

export function PlayerProvider({
	children,
	userId,
}: {
	children: React.ReactNode;
	userId?: string;
}) {
	const [track, setTrack] = useState<Track | null>(null);
	const [isPlaying, setIsPlaying] = useState(false);
	const [currentTime, setCurrentTime] = useState(0);
	const [duration, setDuration] = useState(0);
	const [seekTarget, setSeekTarget] = useState<number | null>(null);
	const lastSavedAtRef = useRef(0);

	const playTrack = useCallback((newTrack: Track, resumeAt = 0) => {
		setTrack(newTrack);
		setCurrentTime(resumeAt);
		setSeekTarget(resumeAt);
		setIsPlaying(true);
	}, []);

	const togglePlay = useCallback(() => setIsPlaying((p) => !p), []);
	const setPlaying = useCallback(
		(playing: boolean) => setIsPlaying(playing),
		[],
	);
	const seekTo = useCallback((seconds: number) => {
		setCurrentTime(seconds);
		setSeekTarget(seconds);
	}, []);
	const clearSeekTarget = useCallback(() => setSeekTarget(null), []);

	const reportProgress = useCallback(
		(seconds: number) => {
			setCurrentTime(seconds);
			if (!userId || !track) return;
			const now = Date.now();
			if (now - lastSavedAtRef.current < 15000) return;
			lastSavedAtRef.current = now;

			const supabase = createClient();
			supabase
				.from("listening_history")
				.upsert(
					{
						user_id: userId,
						episode_id: track.episodeId || null,
						episode_title: track.episodeTitle,
						audio_url: track.storagePath || track.audioUrl,
						source_type: track.sourceType,
						storage_path: track.storagePath || null,
						artwork_url: track.artworkUrl || null,
						duration_seconds: track.durationSeconds || null,
						last_position_seconds: Math.floor(seconds),
						last_listened_at: new Date().toISOString(),
					},
					{ onConflict: "user_id,audio_url" },
				)
				.then(({ error }) => {
					if (error)
						console.error("Failed to save listening history:", error.message);
				});
		},
		[userId, track],
	);

	return (
		<PlayerContext.Provider
			value={{
				track,
				isPlaying,
				currentTime,
				duration,
				seekTarget,
				playTrack,
				togglePlay,
				seekTo,
				clearSeekTarget,
				setPlaying,
				reportProgress,
				setDuration,
			}}
		>
			{children}
		</PlayerContext.Provider>
	);
}

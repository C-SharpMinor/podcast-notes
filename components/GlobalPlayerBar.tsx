"use client";

import dynamic from "next/dynamic";
import { useRef, useEffect } from "react";
import { usePlayer } from "@/contexts/PlayerContext";

const ReactPlayer = dynamic(() => import("react-player"), {
	ssr: false,
}) as any;

function formatTime(seconds: number) {
	if (!isFinite(seconds)) return "0:00";
	const m = Math.floor(seconds / 60).toString();
	const s = Math.floor(seconds % 60)
		.toString()
		.padStart(2, "0");
	return `${m}:${s}`;
}

export default function GlobalPlayerBar() {
	const {
		track,
		isPlaying,
		currentTime,
		duration,
		seekTarget,
		togglePlay,
		seekTo,
		clearSeekTarget,
		reportProgress,
		setDuration,
	} = usePlayer();
	const playerRef = useRef<any>(null);
	const barRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (seekTarget !== null && playerRef.current) {
			playerRef.current.seekTo(seekTarget, "seconds");
			clearSeekTarget();
		}
	}, [seekTarget, clearSeekTarget]);

	if (!track) return null;

	const isYouTube = track.sourceType === "youtube";
	const progressPct =
		duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

	const handleSeekClick = (e: React.MouseEvent<HTMLDivElement>) => {
		if (!barRef.current || duration <= 0) return;
		const rect = barRef.current.getBoundingClientRect();
		const pct = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
		seekTo(pct * duration);
	};

	const skip = (delta: number) => {
		seekTo(
			Math.min(
				Math.max(0, currentTime + delta),
				duration || currentTime + delta,
			),
		);
	};

	return (
		<div className="fixed bottom-0 left-0 right-0 z-40 flex justify-center px-4 pb-4 pointer-events-none">
			<div
				className="pointer-events-auto w-full max-w-md rounded-[28px] border border-[var(--border)] overflow-hidden"
				style={{
					background: "color-mix(in srgb, var(--surface) 82%, transparent)",
					backdropFilter: "blur(24px)",
					WebkitBackdropFilter: "blur(24px)",
					boxShadow:
						"0 12px 40px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.12)",
				}}
			>
				<div
					ref={barRef}
					onClick={handleSeekClick}
					className="h-1.5 w-full bg-[var(--border)] cursor-pointer group"
				>
					<div
						className="h-full bg-[var(--accent)] transition-[width] group-hover:brightness-110"
						style={{ width: `${progressPct}%` }}
					/>
				</div>

				<div className="flex items-center gap-3 px-3.5 py-2.5">
					<div className="w-10 h-10 rounded-xl overflow-hidden bg-[var(--bg)] border border-[var(--border)] shrink-0 flex items-center justify-center">
						{isYouTube ? (
							<ReactPlayer
								ref={playerRef}
								url={track.audioUrl}
								playing={isPlaying}
								width="100%"
								height="100%"
								onProgress={(p: any) => reportProgress(p.playedSeconds)}
								onDuration={(d: number) => setDuration(d)}
								onEnded={() => togglePlay()}
								config={{ youtube: { playerVars: { controls: 0 } } }}
							/>
						) : track.artworkUrl ? (
							// eslint-disable-next-line @next/next/no-img-element
							<img
								src={track.artworkUrl}
								alt=""
								className="w-full h-full object-cover"
							/>
						) : (
							<span className="text-[var(--text-muted)] text-xs">♪</span>
						)}
					</div>

					{!isYouTube && (
						<div className="hidden">
							<ReactPlayer
								ref={playerRef}
								url={track.audioUrl}
								playing={isPlaying}
								onProgress={(p: any) => reportProgress(p.playedSeconds)}
								onDuration={(d: number) => setDuration(d)}
								onEnded={() => togglePlay()}
							/>
						</div>
					)}

					<div className="flex-1 min-w-0">
						<p className="text-sm font-medium text-[var(--text)] truncate">
							{track.episodeTitle}
						</p>
						<p className="text-xs text-[var(--text-muted)]">
							{formatTime(currentTime)} / {formatTime(duration)}
						</p>
					</div>

					<button
						onClick={() => skip(-15)}
						className="text-[var(--text-muted)] hover:text-[var(--text)] transition-colors shrink-0"
						aria-label="Back 15 seconds"
					>
						<svg
							width="18"
							height="18"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
						>
							<polyline points="1 4 1 10 7 10" />
							<path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
						</svg>
					</button>

					<button
						onClick={togglePlay}
						className="w-9 h-9 rounded-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white flex items-center justify-center shrink-0 transition-colors"
						aria-label={isPlaying ? "Pause" : "Play"}
					>
						{isPlaying ? (
							<svg
								width="14"
								height="14"
								viewBox="0 0 24 24"
								fill="currentColor"
							>
								<rect x="6" y="5" width="4" height="14" />
								<rect x="14" y="5" width="4" height="14" />
							</svg>
						) : (
							<svg
								width="14"
								height="14"
								viewBox="0 0 24 24"
								fill="currentColor"
							>
								<path d="M8 5v14l11-7z" />
							</svg>
						)}
					</button>

					<button
						onClick={() => skip(15)}
						className="text-[var(--text-muted)] hover:text-[var(--text)] transition-colors shrink-0"
						aria-label="Forward 15 seconds"
					>
						<svg
							width="18"
							height="18"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
						>
							<polyline points="23 4 23 10 17 10" />
							<path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
						</svg>
					</button>
				</div>
			</div>
		</div>
	);
}

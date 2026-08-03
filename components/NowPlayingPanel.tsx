"use client";

import { useState, useRef, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import HighlightsStrip from "@/components/HighlightsStrip";
import { resolveEpisodeId } from "@/utils/resolveEpisode";
import { usePlayer } from "@/contexts/PlayerContext";

type TranscriptSegment = { start: number; end: number; text: string };

function getTranscriptWindow(
	segments: TranscriptSegment[],
	timestamp: number,
	lookbackSeconds = 45,
) {
	const windowStart = Math.max(0, timestamp - lookbackSeconds);
	return segments
		.filter((s) => s.end >= windowStart && s.start <= timestamp)
		.map((s) => s.text)
		.join(" ");
}

export default function NowPlayingPanel({ userId }: { userId?: string }) {
	const { track, currentTime, setPlaying } = usePlayer();

	const mediaRecorderRef = useRef<MediaRecorder | null>(null);
	const audioChunksRef = useRef<Blob[]>([]);
	const recordingMimeTypeRef = useRef("audio/webm");
	const noteTimestampRef = useRef(0);
	const episodeSegmentsRef = useRef<TranscriptSegment[]>([]);
	const fetchingKeyRef = useRef<string | null>(null);

	const [isRecording, setIsRecording] = useState(false);
	const [isProcessingAI, setIsProcessingAI] = useState(false);
	const [errorMessage, setErrorMessage] = useState("");
	const [savedNotes, setSavedNotes] = useState<any[]>([]);
	const [transcriptStatus, setTranscriptStatus] = useState<
		"idle" | "loading" | "ready" | "error"
	>("idle");
	const [transcriptError, setTranscriptError] = useState("");
	const [segments, setSegments] = useState<TranscriptSegment[]>([]);
	const [episodeId, setEpisodeId] = useState<string | null>(null);

	useEffect(() => {
		return () => {
			mediaRecorderRef.current?.stream.getTracks().forEach((t) => t.stop());
		};
	}, []);

	const audioUrl = track?.audioUrl;
	const episodeTitle = track?.episodeTitle;
	const storagePath = track?.storagePath;
	const sourceMeta = track?.sourceMeta;
	const effectiveSourceType = track?.sourceType || "rss";

	useEffect(() => {
		if (!audioUrl || !sourceMeta) {
			setEpisodeId(track?.episodeId ?? null);
			return;
		}
		const supabase = createClient();
		resolveEpisodeId(supabase, {
			sourceType: effectiveSourceType,
			sourceTitle: sourceMeta.sourceTitle,
			sourceUrl: sourceMeta.sourceUrl,
			authorName: sourceMeta.authorName,
			episodeTitle: episodeTitle || "Unknown Episode",
			episodeAudioUrl: storagePath || audioUrl,
		}).then(setEpisodeId);
	}, [
		audioUrl,
		episodeTitle,
		storagePath,
		sourceMeta,
		effectiveSourceType,
		track?.episodeId,
	]);

	useEffect(() => {
		if (!audioUrl) return;

		const fetchKey = `${effectiveSourceType}:${storagePath || audioUrl}`;
		if (fetchingKeyRef.current === fetchKey) return;
		fetchingKeyRef.current = fetchKey;

		setSavedNotes([]);
		episodeSegmentsRef.current = [];
		setSegments([]);
		setTranscriptStatus("loading");
		setTranscriptError("");

		const endpoint =
			effectiveSourceType === "youtube"
				? "/api/transcribe-youtube"
				: "/api/transcribe-episode";
		const body =
			effectiveSourceType === "youtube"
				? { videoUrl: audioUrl }
				: effectiveSourceType === "upload"
					? { storagePath }
					: { audioUrl };

		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), 270_000);

		fetch(endpoint, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
			signal: controller.signal,
		})
			.then((r) => r.json())
			.then((data) => {
				if (data.segments) {
					episodeSegmentsRef.current = data.segments;
					setSegments(data.segments);
					setTranscriptStatus("ready");
				} else {
					setTranscriptStatus("error");
					setTranscriptError(data.error || "");
				}
			})
			.catch(() => setTranscriptStatus("error"))
			.finally(() => {
				clearTimeout(timeoutId);
				if (fetchingKeyRef.current === fetchKey) fetchingKeyRef.current = null;
			});

		return () => clearTimeout(timeoutId);
	}, [audioUrl, effectiveSourceType, storagePath]);

	const startRecording = async () => {
		if (!audioUrl) return setErrorMessage("Load an episode or video first.");
		noteTimestampRef.current = currentTime;
		setPlaying(false);

		try {
			const stream = await navigator.mediaDevices.getUserMedia({
				audio: { noiseSuppression: true, echoCancellation: true },
			});
			const mimeType = MediaRecorder.isTypeSupported("audio/webm")
				? "audio/webm"
				: "audio/mp4";
			recordingMimeTypeRef.current = mimeType;

			const mediaRecorder = new MediaRecorder(stream, { mimeType });
			mediaRecorderRef.current = mediaRecorder;
			audioChunksRef.current = [];
			mediaRecorder.ondataavailable = (e) => {
				if (e.data.size > 0) audioChunksRef.current.push(e.data);
			};
			mediaRecorder.onstop = processAudioRecording;
			mediaRecorder.start();
			setIsRecording(true);
			setErrorMessage("");
		} catch {
			setErrorMessage("Mic access denied. Check your browser permissions.");
		}
	};

	const stopRecording = () => {
		if (mediaRecorderRef.current && isRecording) {
			mediaRecorderRef.current.stop();
			setIsRecording(false);
			mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
		}
	};

	const processAudioRecording = async () => {
		const audioBlob = new Blob(audioChunksRef.current, {
			type: recordingMimeTypeRef.current,
		});
		const currentTs = noteTimestampRef.current;

		if (audioBlob.size < 1000) {
			setErrorMessage("Recording too short.");
			return;
		}

		setIsProcessingAI(true);

		try {
			const sourceContext = getTranscriptWindow(
				episodeSegmentsRef.current,
				currentTs,
			);
			const formData = new FormData();
			formData.append("audio", audioBlob);
			formData.append("timestamp", currentTs.toString());
			formData.append("episodeTitle", episodeTitle || "Unknown Episode");
			formData.append("sourceContext", sourceContext);

			const res = await fetch("/api/process-voice-note", {
				method: "POST",
				body: formData,
			});
			const aiData = await res.json();
			if (aiData.error) throw new Error(aiData.error);

			if (userId) {
				const supabase = createClient();
				const { error: dbError } = await supabase.from("user_notes").insert({
					user_id: userId,
					episode_id: episodeId,
					episode_title: episodeTitle || "Unknown Episode",
					timestamp_seconds: Math.floor(currentTs),
					raw_transcript: aiData.raw_transcript,
					ai_summary: aiData.summary,
					refined_quote: aiData.refined_quote,
					emotional_flag: aiData.emotional_flag,
					source: "user",
				});
				if (dbError) {
					if (dbError.message.includes("monthly_note_limit_reached")) {
						setErrorMessage(
							"You've hit your free plan's 20 notes this month — upgrade to Pro for unlimited.",
						);
					} else {
						console.error(
							"Supabase insert error:",
							dbError.message,
							dbError.details,
							dbError.hint,
						);
					}
				}
			}

			setSavedNotes((prev) =>
				[
					{
						time: Math.floor(currentTs),
						text: aiData.refined_quote,
						summary: aiData.summary,
						flag: aiData.emotional_flag,
					},
					...prev,
				].sort((a, b) => b.time - a.time),
			);
		} catch {
			setErrorMessage("AI processing failed.");
		} finally {
			setIsProcessingAI(false);
		}
	};

	const formatTime = (seconds: number) => {
		const m = Math.floor(seconds / 60)
			.toString()
			.padStart(2, "0");
		const s = Math.floor(seconds % 60)
			.toString()
			.padStart(2, "0");
		return `${m}:${s}`;
	};

	if (!track) return null;

	return (
		<div className="max-w-md mx-auto p-6 bg-[var(--surface)] text-[var(--text)] rounded-2xl shadow-sm border border-[var(--border)]">
			<h2 className="text-lg font-semibold mb-1 truncate text-center tracking-tight">
				{episodeTitle || "Media Player"}
			</h2>
			<p className="text-center text-xs text-[var(--text-muted)] mb-5">
				{formatTime(currentTime)} elapsed · playback controls are in the bar
				below
			</p>

			<div className="flex flex-col items-center mb-8">
				<p className="text-[var(--text-muted)] text-sm mb-4">
					Press and hold to take a note
				</p>
				<button
					onMouseDown={startRecording}
					onMouseUp={stopRecording}
					onMouseLeave={stopRecording}
					onTouchStart={startRecording}
					onTouchEnd={stopRecording}
					onContextMenu={(e) => e.preventDefault()}
					className={`relative w-28 h-28 rounded-full font-medium shadow-md transition-all duration-200 flex items-center justify-center select-none text-white ${
						isRecording
							? "bg-[var(--danger)] scale-95"
							: "bg-[var(--accent)] hover:bg-[var(--accent-hover)] hover:scale-105"
					}`}
				>
					{isRecording && (
						<span className="absolute inset-0 rounded-full bg-[var(--danger)] opacity-40 animate-ping" />
					)}
					<span className="relative text-sm">
						{isRecording ? "Recording…" : "Hold"}
					</span>
				</button>
			</div>

			<div className="flex flex-col items-center mb-4 gap-2">
				{errorMessage && (
					<div className="w-full bg-[var(--danger)]/10 border border-[var(--danger)]/30 text-[var(--danger)] px-4 py-2 rounded-xl text-sm text-center">
						{errorMessage}
					</div>
				)}
				{isProcessingAI && (
					<div className="text-sm text-[var(--accent)] font-medium bg-[var(--accent-soft)] px-4 py-2 rounded-full flex items-center gap-2">
						<span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
						AI is processing…
					</div>
				)}
			</div>

			{transcriptStatus === "loading" && (
				<div className="border-t border-[var(--border)] pt-5 mb-5 space-y-2 animate-pulse">
					<div className="h-3 w-32 rounded bg-[var(--surface-hover)]" />
					<div className="h-16 rounded-xl bg-[var(--surface-hover)]" />
					<div className="h-16 rounded-xl bg-[var(--surface-hover)]" />
				</div>
			)}
			{transcriptStatus === "error" && (
				<p className="text-[11px] text-[var(--danger)] border-t border-[var(--border)] pt-5 mb-5">
					{transcriptError || "Couldn't prepare a transcript for this episode."}
				</p>
			)}

			<HighlightsStrip
				episodeKey={storagePath || audioUrl}
				episodeId={episodeId}
				episodeTitle={episodeTitle}
				segments={segments}
				status={transcriptStatus}
				userId={userId}
			/>

			<div className="border-t border-[var(--border)] pt-5">
				<h3 className="font-medium text-sm text-[var(--text-muted)] mb-3">
					Your notes this session
				</h3>
				{savedNotes.length === 0 ? (
					<p className="text-[var(--text-muted)] text-xs italic text-center py-2">
						Notes will appear here after AI processing.
					</p>
				) : (
					<ul className="space-y-3">
						{savedNotes.map((note, i) => (
							<li
								key={i}
								className="bg-[var(--bg)] p-4 rounded-xl border border-[var(--border)] animate-in fade-in slide-in-from-top-2"
							>
								<div className="flex justify-between items-start mb-2">
									<span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--accent)] bg-[var(--accent-soft)] px-2 py-0.5 rounded-md">
										{note.flag || "Note"}
									</span>
									<span className="font-mono text-[var(--text-muted)] text-xs">
										{formatTime(note.time)}
									</span>
								</div>
								<p className="text-[var(--text)] text-sm font-medium leading-snug">
									{note.summary}
								</p>
								<p className="text-[var(--text-muted)] text-xs italic mt-2 border-l-2 border-[var(--border)] pl-2">
									"{note.text}"
								</p>
							</li>
						))}
					</ul>
				)}
			</div>
		</div>
	);
}

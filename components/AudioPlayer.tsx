"use client";

import { useState, useRef, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import dynamic from "next/dynamic";

// FIX 1: Use Dynamic import to prevent SSR crashes
const ReactPlayer = dynamic(() => import("react-player"), {
	ssr: false,
}) as any;

interface AudioPlayerProps {
	audioUrl?: string;
	episodeTitle?: string;
	userId?: string;
}

export default function AudioPlayer({
	audioUrl,
	episodeTitle,
	userId,
}: AudioPlayerProps) {
	const playerRef = useRef<any>(null);
	const mediaRecorderRef = useRef<MediaRecorder | null>(null);
	const audioChunksRef = useRef<Blob[]>([]);

	const [isPlaying, setIsPlaying] = useState(false);
	const [isRecording, setIsRecording] = useState(false);
	const [isProcessingAI, setIsProcessingAI] = useState(false);
	const [errorMessage, setErrorMessage] = useState("");
	const [savedNotes, setSavedNotes] = useState<any[]>([]);

	const [isMounted, setIsMounted] = useState(false);
	useEffect(() => setIsMounted(true), []);

	const startRecording = async () => {
		if (!audioUrl) return setErrorMessage("Load an episode or video first!");
		try {
			const stream = await navigator.mediaDevices.getUserMedia({
				audio: { noiseSuppression: true, echoCancellation: true },
			});
			const mediaRecorder = new MediaRecorder(stream);
			mediaRecorderRef.current = mediaRecorder;
			audioChunksRef.current = [];
			mediaRecorder.ondataavailable = (e) => {
				if (e.data.size > 0) audioChunksRef.current.push(e.data);
			};
			mediaRecorder.onstop = processAudioRecording;
			mediaRecorder.start();
			setIsRecording(true);
			setErrorMessage("");
		} catch (err) {
			setErrorMessage("Mic access denied. Check browser permissions.");
		}
	};

	const stopRecording = () => {
		if (mediaRecorderRef.current && isRecording) {
			mediaRecorderRef.current.stop();
			setIsRecording(false);
			mediaRecorderRef.current.stream
				.getTracks()
				.forEach((track) => track.stop());
		}
	};

	const processAudioRecording = async () => {
		const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });

		// FIX 2: Better time capture logic
		const currentTime = playerRef.current?.getCurrentTime() || 0;

		if (audioBlob.size < 1000) {
			setErrorMessage("Recording too short.");
			return;
		}

		setIsProcessingAI(true);

		try {
			const formData = new FormData();
			formData.append("audio", audioBlob);
			formData.append("timestamp", currentTime.toString());
			formData.append("episodeTitle", episodeTitle || "Unknown Episode");

			const res = await fetch("/api/process-voice-note", {
				method: "POST",
				body: formData,
			});

			const aiData = await res.json();
			if (aiData.error) throw new Error(aiData.error);

			// SAVE TO SUPABASE
			if (userId) {
				const supabase = createClient();
				const { error: dbError } = await supabase.from("user_notes").insert({
					user_id: userId,
					episode_title: episodeTitle || "Unknown Episode",
					timestamp_seconds: Math.floor(currentTime),
					raw_transcript: aiData.raw_transcript,
					ai_summary: aiData.summary,
					refined_quote: aiData.refined_quote,
					emotional_flag: aiData.emotional_flag,
				});
				if (dbError) console.error("Supabase Error:", dbError.message);
			}

			// Update UI list
			setSavedNotes((prev) => [
				{
					time: Math.floor(currentTime),
					text: aiData.refined_quote,
					summary: aiData.summary,
					flag: aiData.emotional_flag,
				},
				...prev,
			]);
		} catch (error: any) {
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

	const isYouTube =
		audioUrl?.includes("youtube.com") || audioUrl?.includes("youtu.be");

	return (
		<div className="max-w-md mx-auto p-6 bg-slate-900 text-white rounded-xl shadow-lg mt-10 border border-slate-800">
			<h2 className="text-xl font-bold mb-4 truncate text-center">
				{episodeTitle || "Media Player"}
			</h2>

			{isMounted && audioUrl && (
				<div className="mb-6 rounded-lg overflow-hidden border border-slate-700 bg-black flex justify-center">
					<ReactPlayer
						ref={playerRef}
						url={audioUrl}
						width="100%"
						height={isYouTube ? "240px" : "50px"}
						controls={true}
						playing={isPlaying}
						onPlay={() => setIsPlaying(true)}
						onPause={() => setIsPlaying(false)}
					/>
				</div>
			)}

			<div className="flex flex-col items-center mb-8">
				<p className="text-gray-400 text-sm mb-3">
					Press and hold to take a note
				</p>
				<button
					onMouseDown={startRecording}
					onMouseUp={stopRecording}
					onMouseLeave={stopRecording}
					onTouchStart={startRecording}
					onTouchEnd={stopRecording}
					onContextMenu={(e) => e.preventDefault()}
					className={`w-32 h-32 rounded-full font-bold shadow-2xl transition-all duration-200 flex items-center justify-center select-none ${
						isRecording
							? "bg-red-500 scale-95 shadow-red-500/50 ring-4 ring-red-400"
							: "bg-red-700 hover:bg-red-600 hover:scale-105"
					}`}
				>
					{isRecording ? "🎙 Recording..." : "🎤 Hold"}
				</button>
			</div>

			<div className="flex flex-col items-center mb-4">
				{errorMessage && (
					<div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-2 rounded-lg text-sm mb-2">
						{errorMessage}
					</div>
				)}
				{isProcessingAI && (
					<div className="text-sm text-blue-400 animate-pulse font-medium bg-blue-900/30 px-4 py-2 rounded-full">
						🤖 AI is processing...
					</div>
				)}
			</div>

			<div className="border-t border-slate-700 pt-4">
				<h3 className="font-semibold text-gray-300 mb-4">
					Recent Session Notes:
				</h3>
				{savedNotes.length === 0 ? (
					<p className="text-gray-500 text-xs italic text-center">
						Notes will appear here after AI processing.
					</p>
				) : (
					<ul className="space-y-4">
						{savedNotes.map((note, i) => (
							<li
								key={i}
								className="bg-slate-800 p-4 rounded-lg border border-slate-700 animate-in fade-in slide-in-from-top-2"
							>
								<div className="flex justify-between items-start mb-2">
									<span className="text-[10px] font-bold uppercase tracking-wider text-purple-300 bg-purple-900/50 px-2 py-0.5 rounded">
										{note.flag || "Note"}
									</span>
									<span className="font-mono text-blue-400 text-xs">
										{formatTime(note.time)}
									</span>
								</div>
								<p className="text-white text-sm font-medium leading-tight">
									{note.summary}
								</p>
								<p className="text-gray-400 text-xs italic mt-2 border-l border-gray-600 pl-2">
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

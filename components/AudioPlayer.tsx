"use client";

import { useState, useRef } from "react";
import { createClient } from "@/utils/supabase/client";

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
	const audioRef = useRef<HTMLAudioElement>(null);
	const mediaRecorderRef = useRef<MediaRecorder | null>(null);
	const audioChunksRef = useRef<Blob[]>([]);

	const [isPlaying, setIsPlaying] = useState(false);
	const [isRecording, setIsRecording] = useState(false);
	const [isProcessingAI, setIsProcessingAI] = useState(false);
	const [errorMessage, setErrorMessage] = useState("");
	const [savedNotes, setSavedNotes] = useState<
		{ time: number; text: string; summary?: string; flag?: string }[]
	>([]);

	// Play/Pause Audio
	const togglePlay = () => {
		if (audioRef.current && audioUrl) {
			if (isPlaying) audioRef.current.pause();
			else audioRef.current.play();
			setIsPlaying(!isPlaying);
		} else if (!audioUrl) {
			alert("Please select an episode first!");
		}
	};

	// START RECORDING (Hold Button)
	const startRecording = async () => {
		if (!audioUrl) return setErrorMessage("Load an episode first!");

		try {
			// 1. Request Mic Access with HARDWARE NOISE CANCELLATION
			const stream = await navigator.mediaDevices.getUserMedia({
				audio: {
					noiseSuppression: true,
					echoCancellation: true,
					autoGainControl: true,
				},
			});

			const mediaRecorder = new MediaRecorder(stream);
			mediaRecorderRef.current = mediaRecorder;
			audioChunksRef.current = [];

			mediaRecorder.ondataavailable = (event) => {
				if (event.data.size > 0) audioChunksRef.current.push(event.data);
			};

			mediaRecorder.onstop = processAudioRecording;

			mediaRecorder.start();
			setIsRecording(true);
			setErrorMessage("");
		} catch (err) {
			console.error("Mic access denied:", err);
			setErrorMessage("Please allow microphone access in your browser.");
		}
	};

	// STOP RECORDING (Release Button)
	const stopRecording = () => {
		if (mediaRecorderRef.current && isRecording) {
			mediaRecorderRef.current.stop();
			setIsRecording(false);
			// Stop all mic tracks to save battery
			mediaRecorderRef.current.stream
				.getTracks()
				.forEach((track) => track.stop());
		}
	};

	// PROCESS THE AUDIO (Triggered automatically when recording stops)
	const processAudioRecording = async () => {
		const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
		const currentTime = audioRef.current?.currentTime || 0;

		if (audioBlob.size < 1000) {
			setErrorMessage("Recording was too short.");
			setTimeout(() => setErrorMessage(""), 3000);
			return;
		}

		setIsProcessingAI(true);

		try {
			// 1. Package the audio file and context into FormData
			const formData = new FormData();
			formData.append("audio", audioBlob);
			formData.append("timestamp", currentTime.toString());
			formData.append("episodeTitle", episodeTitle || "Unknown Episode");

			// 2. Send to our new unified Whisper + Llama pipeline
			const res = await fetch("/api/process-voice-note", {
				method: "POST",
				body: formData,
			});

			const aiData = await res.json();

			if (aiData.error) throw new Error(aiData.error);

			// 3. Save to Supabase
			if (userId) {
				const supabase = createClient();
				const { error: dbError } = await supabase.from("user_notes").insert({
					user_id: userId,
					timestamp_seconds: Math.floor(currentTime),
					trigger_phrase: "Hold to Record",
					raw_transcript: aiData.raw_transcript, // Got this straight from Whisper
					ai_summary: aiData.summary,
					emotional_flag: aiData.emotional_flag,
				});

				if (dbError) console.error("Supabase Save Error:", dbError);
			}

			// 4. Update the UI
			setSavedNotes((prev) => [
				...prev,
				{
					time: Math.floor(currentTime),
					text: aiData.refined_quote,
					summary: aiData.summary,
					flag: aiData.emotional_flag,
				},
			]);
		} catch (error: any) {
			console.error("Pipeline Error:", error);
			setErrorMessage("Failed to process note. Try again.");
			setTimeout(() => setErrorMessage(""), 3000);
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

	return (
		<div className="max-w-md mx-auto p-6 bg-slate-900 text-white rounded-xl shadow-lg mt-10 border border-slate-800">
			<h2 className="text-xl font-bold mb-2 truncate">
				{episodeTitle || "Podcast MVP Player"}
			</h2>

			{audioUrl && (
				<audio
					ref={audioRef}
					src={audioUrl}
					onEnded={() => setIsPlaying(false)}
				/>
			)}

			<div className="flex gap-4 mb-6 mt-4">
				<button
					onClick={togglePlay}
					className="flex-1 bg-blue-600 hover:bg-blue-500 py-4 rounded-lg font-bold transition flex items-center justify-center"
				>
					{isPlaying ? "⏸ Pause Audio" : "▶️ Play Audio"}
				</button>
			</div>

			{/* The New Hold-to-Record Button */}
			<div className="flex flex-col items-center mb-8">
				<p className="text-gray-400 text-sm mb-3">
					Press and hold to take a note
				</p>
				<button
					onMouseDown={startRecording}
					onMouseUp={stopRecording}
					onMouseLeave={stopRecording} // Stops if they drag their mouse off the button
					onTouchStart={startRecording} // Mobile support
					onTouchEnd={stopRecording} // Mobile support
					onContextMenu={(e) => e.preventDefault()} // Prevents the right-click menu on mobile long-press
					className={`w-32 h-32 rounded-full font-bold shadow-2xl transition-all duration-200 flex items-center justify-center select-none ${
						isRecording
							? "bg-red-500 scale-95 shadow-red-500/50 ring-4 ring-red-400"
							: "bg-red-700 hover:bg-red-600 hover:scale-105"
					}`}
				>
					{isRecording ? "🎙 Recording..." : "🎤 Hold"}
				</button>
			</div>

			{/* UI States and Note List */}
			<div>
				<div className="flex flex-col items-center mb-4">
					{errorMessage && (
						<div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-2 rounded-lg mb-2 text-sm text-center w-full">
							{errorMessage}
						</div>
					)}
					{isProcessingAI && (
						<div className="text-sm text-blue-400 animate-pulse font-medium bg-blue-900/30 px-4 py-2 rounded-full">
							🤖 AI is transcribing & analyzing...
						</div>
					)}
				</div>

				<div className="flex justify-between items-center mb-4 border-b border-slate-700 pb-2">
					<h3 className="font-semibold text-gray-300">Your Notes:</h3>
				</div>

				{savedNotes.length === 0 ? (
					<p className="text-gray-500 text-sm text-center italic mt-6">
						Hold the red button to capture your thoughts.
					</p>
				) : (
					<ul className="space-y-4">
						{savedNotes.map((note, index) => (
							<li
								key={index}
								className="bg-slate-800 p-4 rounded-lg border border-slate-700"
							>
								<div className="flex justify-between items-start mb-2">
									<span className="text-xs font-bold uppercase tracking-wider text-purple-300 bg-purple-900/50 px-2 py-1 rounded">
										{note.flag || "Note"}
									</span>
									<span className="font-mono text-blue-400 text-sm bg-blue-900/30 px-2 py-1 rounded">
										{formatTime(note.time)}
									</span>
								</div>
								<p className="text-white font-medium mb-1">{note.summary}</p>
								<p className="text-gray-400 text-sm italic border-l-2 border-gray-600 pl-3 mt-2">
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

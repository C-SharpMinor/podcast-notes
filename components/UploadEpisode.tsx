// components/UploadEpisode.tsx
"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";

interface UploadEpisodeProps {
	userId: string;
	onUploaded: (episode: {
		audioUrl: string;
		storagePath: string;
		title: string;
	}) => void;
}

const MAX_FILE_SIZE_BYTES = 200 * 1024 * 1024; // 200MB

export default function UploadEpisode({
	userId,
	onUploaded,
}: UploadEpisodeProps) {
	const [isUploading, setIsUploading] = useState(false);
	const [error, setError] = useState("");

	const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;

		if (file.size > MAX_FILE_SIZE_BYTES) {
			setError(
				`That file is too large (${(file.size / 1024 / 1024).toFixed(0)}MB). Please upload something under 200MB.`,
			);
			e.target.value = ""; // reset the input so re-selecting the same file re-fires onChange
			return;
		}

		setIsUploading(true);
		setError("");

		try {
			const supabase = createClient();
			const path = `${userId}/${crypto.randomUUID()}-${file.name}`;

			const { error: uploadError } = await supabase.storage
				.from("episode-audio")
				.upload(path, file);
			if (uploadError) throw uploadError;

			const { data: signed, error: signError } = await supabase.storage
				.from("episode-audio")
				.createSignedUrl(path, 3600);
			if (signError || !signed)
				throw signError || new Error("Could not create playback URL");

			const { error: dbError } = await supabase
				.from("user_uploads")
				.insert({ user_id: userId, storage_path: path, title: file.name });
			if (dbError)
				console.error("Failed to save upload record:", dbError.message);

			onUploaded({
				audioUrl: signed.signedUrl,
				storagePath: path,
				title: file.name,
			});
		} catch (err: any) {
			setError(err.message || "Upload failed.");
		} finally {
			setIsUploading(false);
		}
	};

	return (
		<div className="max-w-md mx-auto mt-6 text-center">
			<label className="inline-block cursor-pointer bg-slate-800 hover:bg-slate-700 text-white text-sm px-4 py-2 rounded-lg border border-slate-700">
				{isUploading ? "Uploading..." : "Upload an audio or video file"}
				<input
					type="file"
					accept="audio/*,video/*"
					className="hidden"
					disabled={isUploading}
					onChange={handleFileChange}
				/>
			</label>
			<p className="text-[11px] text-gray-500 mt-2">Max 200MB</p>
			{error && <p className="text-red-400 text-xs mt-2">{error}</p>}
		</div>
	);
}

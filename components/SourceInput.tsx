"use client";

import { useState } from "react";

interface SourceInputProps {
	onSubmitLink: (url: string) => void;
	onSearch: (query: string) => void;
	isLoading?: boolean;
	isSearching?: boolean;
}

function looksLikeUrl(value: string) {
	return (
		/^https?:\/\//i.test(value.trim()) || /\.[a-z]{2,}\//i.test(value.trim())
	);
}

export default function SourceInput({
	onSubmitLink,
	onSearch,
	isLoading,
	isSearching,
}: SourceInputProps) {
	const [value, setValue] = useState("");
	const busy = isLoading || isSearching;

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		const trimmed = value.trim();
		if (!trimmed) return;
		looksLikeUrl(trimmed) ? onSubmitLink(trimmed) : onSearch(trimmed);
	};

	return (
		<form onSubmit={handleSubmit} className="w-full max-w-md mx-auto">
			<div className="relative">
				<input
					type="text"
					value={value}
					onChange={(e) => setValue(e.target.value)}
					placeholder="Search a podcast or paste a link..."
					className="w-full bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] rounded-2xl pl-4 pr-24 py-3.5 text-sm placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/30 transition shadow-sm"
				/>
				<button
					type="submit"
					disabled={busy || !value.trim()}
					className="absolute right-1.5 top-1.5 bottom-1.5 px-4 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-sm font-medium transition-colors disabled:opacity-40 flex items-center"
				>
					{busy ? (
						<svg
							className="animate-spin h-4 w-4"
							viewBox="0 0 24 24"
							fill="none"
						>
							<circle
								className="opacity-25"
								cx="12"
								cy="12"
								r="10"
								stroke="currentColor"
								strokeWidth="4"
							/>
							<path
								className="opacity-75"
								fill="currentColor"
								d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
							/>
						</svg>
					) : (
						"Go"
					)}
				</button>
			</div>
			<p className="text-[11px] text-[var(--text-muted)] text-center mt-2">
				Works with RSS feeds, Apple Podcasts links, and YouTube — or just type a
				show's name.
			</p>
		</form>
	);
}

"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { useToast } from "@/components/Toast";

interface TranscriptSegment {
	start: number;
	end: number;
	text: string;
}
interface Highlight {
	timestamp: number;
	type: "highlight" | "list";
	summary: string;
	quote: string | null;
	list_items: string[] | null;
}

interface HighlightsStripProps {
	episodeKey?: string;
	episodeId?: string | null;
	episodeTitle?: string;
	segments: TranscriptSegment[];
	status: "idle" | "loading" | "ready" | "error";
	userId?: string;
}

function formatTime(seconds: number) {
	const m = Math.floor(seconds / 60)
		.toString()
		.padStart(2, "0");
	const s = Math.floor(seconds % 60)
		.toString()
		.padStart(2, "0");
	return `${m}:${s}`;
}

export default function HighlightsStrip({
	episodeKey,
	episodeId,
	episodeTitle,
	segments,
	status,
	userId,
}: HighlightsStripProps) {
	const [highlights, setHighlights] = useState<Highlight[]>([]);
	const [loadState, setLoadState] = useState<
		"idle" | "loading" | "ready" | "error"
	>("idle");
	const [dismissed, setDismissed] = useState<Set<number>>(new Set());
	const [savingIndex, setSavingIndex] = useState<number | null>(null);
	const [savedIndices, setSavedIndices] = useState<Set<number>>(new Set());
	const { showToast } = useToast();

	useEffect(() => {
		if (status !== "ready" || !episodeKey || segments.length === 0) return;

		setLoadState("loading");
		setHighlights([]);
		setDismissed(new Set());
		setSavedIndices(new Set());

		fetch("/api/generate-highlights", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ episodeKey, episodeTitle, segments }),
		})
			.then((r) => r.json())
			.then((data) => {
				if (data.highlights) {
					setHighlights(data.highlights);
					setLoadState("ready");
				} else {
					setLoadState("error");
				}
			})
			.catch(() => setLoadState("error"));
	}, [status, episodeKey, episodeTitle, segments]);

	const saveHighlight = async (highlight: Highlight, index: number) => {
		if (!userId) return;
		setSavingIndex(index);

		try {
			const supabase = createClient();
			const { error } = await supabase.from("user_notes").insert({
				user_id: userId,
				episode_id: episodeId,
				episode_title: episodeTitle || "Unknown Episode",
				timestamp_seconds: Math.floor(highlight.timestamp),
				raw_transcript: null,
				ai_summary: highlight.summary,
				refined_quote: highlight.quote,
				emotional_flag: highlight.type === "list" ? "List" : "Highlight",
				source: "auto",
				list_items: highlight.list_items,
			});
			if (error) throw error;

			setSavedIndices((prev) => new Set(prev).add(index));
			showToast("Saved to your notebook.", "success");
		} catch (err: any) {
			if (err.message?.includes("monthly_note_limit_reached")) {
				showToast(
					"You've hit your free plan's 20 notes this month — upgrade to Pro for unlimited.",
					"error",
				);
			} else {
				console.error(
					"Failed to save highlight:",
					err.message,
					err.details,
					err.hint,
				);
				showToast("Couldn't save that highlight.", "error");
			}
		} finally {
			setSavingIndex(null);
		}
	};

	const visibleHighlights = highlights
		.map((h, i) => ({ ...h, index: i }))
		.filter((h) => !dismissed.has(h.index));

	if (loadState === "idle") return null;

	return (
		<div className="border-t border-[var(--border)] pt-5 mb-5">
			<h3 className="font-medium text-sm text-[var(--text-muted)] mb-3">
				Suggested highlights
			</h3>

			{loadState === "loading" && (
				<div className="space-y-2 animate-pulse">
					{[...Array(2)].map((_, i) => (
						<div
							key={i}
							className="h-16 rounded-xl bg-[var(--surface-hover)]"
						/>
					))}
				</div>
			)}

			{loadState === "error" && (
				<p className="text-xs text-[var(--text-muted)] italic">
					Couldn't generate highlights for this episode.
				</p>
			)}
			{loadState === "ready" && highlights.length === 0 && (
				<p className="text-xs text-[var(--text-muted)] italic">
					Nothing stood out enough to suggest here.
				</p>
			)}

			{loadState === "ready" && visibleHighlights.length > 0 && (
				<ul className="space-y-2">
					{visibleHighlights.map((h) => (
						<li
							key={h.index}
							className="bg-[var(--accent-soft)]/40 border border-[var(--accent)]/20 rounded-xl p-3.5 animate-in fade-in slide-in-from-top-2"
						>
							<span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--accent)]">
								{h.type === "list" ? "List" : "Highlight"} ·{" "}
								{formatTime(h.timestamp)}
							</span>
							<p className="text-[var(--text)] text-sm font-medium leading-snug mt-1">
								{h.summary}
							</p>
							{h.type === "list" && h.list_items && h.list_items.length > 0 && (
								<ul className="mt-1.5 pl-4 list-disc text-xs text-[var(--text-muted)] space-y-0.5">
									{h.list_items.map((item, i) => (
										<li key={i}>{item}</li>
									))}
								</ul>
							)}
							{h.type === "highlight" && h.quote && (
								<p className="text-[var(--text-muted)] text-xs italic mt-1.5 border-l-2 border-[var(--accent)]/30 pl-2">
									"{h.quote}"
								</p>
							)}
							<div className="flex gap-4 mt-2.5">
								{savedIndices.has(h.index) ? (
									<span className="text-xs font-medium text-[var(--success)]">
										Saved
									</span>
								) : (
									<button
										onClick={() => saveHighlight(h, h.index)}
										disabled={savingIndex === h.index}
										className="text-xs font-medium text-[var(--accent)] hover:opacity-80"
									>
										{savingIndex === h.index ? "Saving…" : "Save to notebook"}
									</button>
								)}
								<button
									onClick={() =>
										setDismissed((prev) => new Set(prev).add(h.index))
									}
									className="text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text)]"
								>
									Dismiss
								</button>
							</div>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}

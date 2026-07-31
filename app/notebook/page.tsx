"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { useToast } from "@/components/Toast";

interface Note {
	id: string;
	episode_title: string;
	timestamp_seconds: number;
	raw_transcript: string;
	ai_summary: string;
	refined_quote: string;
	emotional_flag: string;
	created_at: string;
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

export default function NotebookPage() {
	const [notes, setNotes] = useState<Note[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [search, setSearch] = useState("");
	const [showFilter, setShowFilter] = useState("All shows");
	const [editingId, setEditingId] = useState<string | null>(null);
	const [editDraft, setEditDraft] = useState<{
		summary: string;
		refined_quote: string;
		emotional_flag: string;
	} | null>(null);
	const [savingId, setSavingId] = useState<string | null>(null);
	const { showToast } = useToast();

	useEffect(() => {
		const load = async () => {
			const supabase = createClient();
			const { data, error } = await supabase
				.from("user_notes")
				.select("*")
				.order("created_at", { ascending: false });
			if (!error && data) setNotes(data as Note[]);
			setIsLoading(false);
		};
		load();
	}, []);

	const shows = useMemo(
		() => [
			"All shows",
			...Array.from(new Set(notes.map((n) => n.episode_title))),
		],
		[notes],
	);

	const filteredNotes = useMemo(() => {
		return notes.filter((n) => {
			const matchesShow =
				showFilter === "All shows" || n.episode_title === showFilter;
			const q = search.trim().toLowerCase();
			const matchesSearch =
				!q ||
				n.ai_summary?.toLowerCase().includes(q) ||
				n.refined_quote?.toLowerCase().includes(q) ||
				n.episode_title?.toLowerCase().includes(q);
			return matchesShow && matchesSearch;
		});
	}, [notes, search, showFilter]);

	const startEdit = (note: Note) => {
		setEditingId(note.id);
		setEditDraft({
			summary: note.ai_summary || "",
			refined_quote: note.refined_quote || "",
			emotional_flag: note.emotional_flag || "",
		});
	};

	const cancelEdit = () => {
		setEditingId(null);
		setEditDraft(null);
	};

	const saveEdit = async (note: Note) => {
		if (!editDraft) return;
		setSavingId(note.id);
		try {
			const res = await fetch("/api/update-note", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ noteId: note.id, ...editDraft }),
			});
			const data = await res.json();
			if (data.error) throw new Error(data.error);

			setNotes((prev) =>
				prev.map((n) =>
					n.id === note.id
						? {
								...n,
								ai_summary: editDraft.summary,
								refined_quote: editDraft.refined_quote,
								emotional_flag: editDraft.emotional_flag,
							}
						: n,
				),
			);
			setEditingId(null);
			setEditDraft(null);
			showToast("Note updated.", "success");
		} catch {
			showToast("Couldn't save that edit.", "error");
		} finally {
			setSavingId(null);
		}
	};

	const deleteNote = async (noteId: string) => {
		const supabase = createClient();
		const { error } = await supabase
			.from("user_notes")
			.delete()
			.eq("id", noteId);
		if (!error) {
			setNotes((prev) => prev.filter((n) => n.id !== noteId));
			showToast("Note deleted.", "info");
		}
	};

	return (
		<main className="min-h-screen bg-[var(--bg)]">
			<div className="max-w-2xl mx-auto px-4 py-10">
				<div className="flex items-center justify-between mb-8">
					<h1 className="text-2xl font-semibold tracking-tight text-[var(--text)]">
						My Notebook
					</h1>
					<Link
						href="/"
						className="text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
					>
						← Back
					</Link>
				</div>

				<div className="flex flex-col sm:flex-row gap-3 mb-6">
					<input
						type="text"
						placeholder="Search your notes..."
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						className="flex-1 bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-2.5 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/30 transition"
					/>
					<select
						value={showFilter}
						onChange={(e) => setShowFilter(e.target.value)}
						className="bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-2.5 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)] transition"
					>
						{shows.map((show) => (
							<option key={show} value={show}>
								{show}
							</option>
						))}
					</select>
				</div>

				{isLoading ? (
					<div className="space-y-4 animate-pulse">
						{[...Array(3)].map((_, i) => (
							<div
								key={i}
								className="h-28 rounded-2xl bg-[var(--surface-hover)]"
							/>
						))}
					</div>
				) : filteredNotes.length === 0 ? (
					<div className="text-center py-16">
						<p className="text-[var(--text-muted)] text-sm">
							{notes.length === 0
								? "No notes yet — take one while listening and it'll show up here."
								: "Nothing matches that search."}
						</p>
					</div>
				) : (
					<ul className="space-y-4">
						{filteredNotes.map((note) => (
							<li
								key={note.id}
								className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 shadow-sm"
							>
								<div className="flex justify-between items-start mb-2">
									<span className="text-xs text-[var(--text-muted)]">
										{note.episode_title}
									</span>
									<span className="font-mono text-[var(--accent)] text-xs">
										{formatTime(note.timestamp_seconds)}
									</span>
								</div>

								{editingId === note.id ? (
									<div className="space-y-2">
										<input
											className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
											value={editDraft?.summary || ""}
											onChange={(e) =>
												setEditDraft(
													(d) => d && { ...d, summary: e.target.value },
												)
											}
											placeholder="Summary"
										/>
										<textarea
											className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
											value={editDraft?.refined_quote || ""}
											onChange={(e) =>
												setEditDraft(
													(d) => d && { ...d, refined_quote: e.target.value },
												)
											}
											placeholder="Quote"
											rows={2}
										/>
										<input
											className="w-32 bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
											value={editDraft?.emotional_flag || ""}
											onChange={(e) =>
												setEditDraft(
													(d) => d && { ...d, emotional_flag: e.target.value },
												)
											}
											placeholder="Flag"
										/>
										<div className="flex gap-2 pt-1">
											<button
												onClick={() => saveEdit(note)}
												disabled={savingId === note.id}
												className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-medium px-3.5 py-1.5 rounded-lg transition-colors"
											>
												{savingId === note.id ? "Saving…" : "Save"}
											</button>
											<button
												onClick={cancelEdit}
												className="bg-[var(--surface-hover)] text-[var(--text)] text-xs font-medium px-3.5 py-1.5 rounded-lg"
											>
												Cancel
											</button>
										</div>
									</div>
								) : (
									<>
										<span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--accent)] bg-[var(--accent-soft)] px-2 py-0.5 rounded-md">
											{note.emotional_flag || "Note"}
										</span>
										<p className="text-[var(--text)] text-sm font-medium leading-snug mt-2">
											{note.ai_summary}
										</p>
										<p className="text-[var(--text-muted)] text-xs italic mt-2 border-l-2 border-[var(--border)] pl-2">
											"{note.refined_quote}"
										</p>
										<div className="flex gap-4 mt-3">
											<button
												onClick={() => startEdit(note)}
												className="text-xs font-medium text-[var(--accent)] hover:opacity-80"
											>
												Edit
											</button>
											<button
												onClick={() => deleteNote(note.id)}
												className="text-xs font-medium text-[var(--danger)] hover:opacity-80"
											>
												Delete
											</button>
										</div>
									</>
								)}
							</li>
						))}
					</ul>
				)}
			</div>
		</main>
	);
}

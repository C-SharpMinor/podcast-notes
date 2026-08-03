"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { useToast } from "@/components/Toast";

interface Note {
	id: string;
	episode_id: string | null;
	episode_title: string;
	timestamp_seconds: number;
	ai_summary: string;
	refined_quote: string | null;
	emotional_flag: string;
	source?: string;
	list_items?: string[] | null;
}

interface EpisodeNoteRow {
	id: string;
	episode_id: string | null;
	episode_title: string;
	content: string;
	source_note_count: number;
	updated_at: string;
}

interface EpisodeGroup {
	key: string;
	episodeId: string | null;
	episodeTitle: string;
	notes: Note[];
	organizedNote: EpisodeNoteRow | null;
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

function renderOrganizedNote(content: string) {
	const lines = content.split("\n");
	const blocks: React.ReactNode[] = [];
	let listBuffer: string[] = [];

	const flushList = (key: string) => {
		if (listBuffer.length > 0) {
			blocks.push(
				<ul key={key} className="list-disc pl-5 space-y-1 my-2">
					{listBuffer.map((item, i) => (
						<li key={i} className="text-sm text-[var(--text)]">
							{item}
						</li>
					))}
				</ul>,
			);
			listBuffer = [];
		}
	};

	lines.forEach((line, i) => {
		const trimmed = line.trim();
		if (trimmed.startsWith("## ")) {
			flushList(`list-${i}`);
			blocks.push(
				<h4
					key={i}
					className="text-sm font-semibold text-[var(--text)] mt-4 mb-1 first:mt-0"
				>
					{trimmed.slice(3)}
				</h4>,
			);
		} else if (trimmed.startsWith("- ")) {
			listBuffer.push(trimmed.slice(2));
		} else if (trimmed.length === 0) {
			flushList(`list-${i}`);
		} else {
			flushList(`list-${i}`);
			blocks.push(
				<p
					key={i}
					className="text-sm text-[var(--text)] leading-relaxed my-1.5"
				>
					{trimmed}
				</p>,
			);
		}
	});
	flushList("list-end");
	return blocks;
}

export default function NotebookPage() {
	const [groups, setGroups] = useState<EpisodeGroup[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [search, setSearch] = useState("");
	const [showFilter, setShowFilter] = useState("All shows");
	const [expandedRaw, setExpandedRaw] = useState<Set<string>>(new Set());
	const [expandedListIds, setExpandedListIds] = useState<Set<string>>(
		new Set(),
	);
	const [organizingKey, setOrganizingKey] = useState<string | null>(null);
	const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
	const [editDraft, setEditDraft] = useState("");
	const [savingEdit, setSavingEdit] = useState(false);
	const { showToast } = useToast();

	useEffect(() => {
		const load = async () => {
			const supabase = createClient();
			const [{ data: notes }, { data: episodeNotes }] = await Promise.all([
				supabase
					.from("user_notes")
					.select("*")
					.order("timestamp_seconds", { ascending: true }),
				supabase.from("episode_notes").select("*"),
			]);

			const groupMap = new Map<string, EpisodeGroup>();
			(notes || []).forEach((n: Note) => {
				const key = n.episode_id || `title:${n.episode_title}`;
				if (!groupMap.has(key)) {
					groupMap.set(key, {
						key,
						episodeId: n.episode_id,
						episodeTitle: n.episode_title,
						notes: [],
						organizedNote: null,
					});
				}
				groupMap.get(key)!.notes.push(n);
			});
			(episodeNotes || []).forEach((en: EpisodeNoteRow) => {
				const key = en.episode_id || `title:${en.episode_title}`;
				if (groupMap.has(key)) groupMap.get(key)!.organizedNote = en;
			});

			const sorted = Array.from(groupMap.values()).sort((a, b) => {
				const aLatest =
					a.organizedNote?.updated_at ||
					a.notes[a.notes.length - 1]?.timestamp_seconds.toString() ||
					"";
				const bLatest =
					b.organizedNote?.updated_at ||
					b.notes[b.notes.length - 1]?.timestamp_seconds.toString() ||
					"";
				return bLatest.localeCompare(aLatest);
			});

			setGroups(sorted);
			setIsLoading(false);
		};
		load();
	}, []);

	const shows = useMemo(
		() => [
			"All shows",
			...Array.from(new Set(groups.map((g) => g.episodeTitle))),
		],
		[groups],
	);

	const filteredGroups = useMemo(() => {
		return groups.filter((g) => {
			const matchesShow =
				showFilter === "All shows" || g.episodeTitle === showFilter;
			const q = search.trim().toLowerCase();
			const matchesSearch =
				!q ||
				g.episodeTitle.toLowerCase().includes(q) ||
				g.organizedNote?.content.toLowerCase().includes(q) ||
				g.notes.some((n) => n.ai_summary?.toLowerCase().includes(q));
			return matchesShow && matchesSearch;
		});
	}, [groups, search, showFilter]);

	const organizeGroup = async (group: EpisodeGroup) => {
		setOrganizingKey(group.key);
		try {
			const res = await fetch("/api/generate-episode-note", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					episodeId: group.episodeId,
					episodeTitle: group.episodeTitle,
				}),
			});
			const data = await res.json();
			if (data.error) throw new Error(data.error);

			setGroups((prev) =>
				prev.map((g) =>
					g.key === group.key
						? {
								...g,
								organizedNote: {
									id: g.organizedNote?.id || crypto.randomUUID(),
									episode_id: g.episodeId,
									episode_title: g.episodeTitle,
									content: data.content,
									source_note_count: data.sourceNoteCount,
									updated_at: new Date().toISOString(),
								},
							}
						: g,
				),
			);
			showToast("Note organized.", "success");
		} catch (err: any) {
			showToast(
				err.message || "Couldn't organize this episode's notes.",
				"error",
			);
		} finally {
			setOrganizingKey(null);
		}
	};

	const startEditOrganized = (group: EpisodeGroup) => {
		if (!group.organizedNote) return;
		setEditingNoteId(group.organizedNote.id);
		setEditDraft(group.organizedNote.content);
	};

	const saveOrganizedEdit = async (group: EpisodeGroup) => {
		if (!group.organizedNote) return;
		setSavingEdit(true);
		try {
			const res = await fetch("/api/update-episode-note", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					episodeNoteId: group.organizedNote.id,
					content: editDraft,
				}),
			});
			const data = await res.json();
			if (data.error) throw new Error(data.error);

			setGroups((prev) =>
				prev.map((g) =>
					g.key === group.key
						? {
								...g,
								organizedNote: { ...g.organizedNote!, content: editDraft },
							}
						: g,
				),
			);
			setEditingNoteId(null);
			showToast(
				"Note updated — future organized notes will lean toward this style.",
				"success",
			);
		} catch {
			showToast("Couldn't save that edit.", "error");
		} finally {
			setSavingEdit(false);
		}
	};

	const toggleRaw = (key: string) => {
		setExpandedRaw((prev) => {
			const next = new Set(prev);
			next.has(key) ? next.delete(key) : next.add(key);
			return next;
		});
	};

	const toggleList = (id: string) => {
		setExpandedListIds((prev) => {
			const next = new Set(prev);
			next.has(id) ? next.delete(id) : next.add(id);
			return next;
		});
	};

	const deleteRawNote = async (group: EpisodeGroup, noteId: string) => {
		const supabase = createClient();
		const { error } = await supabase
			.from("user_notes")
			.delete()
			.eq("id", noteId);
		if (!error) {
			setGroups((prev) =>
				prev.map((g) =>
					g.key === group.key
						? { ...g, notes: g.notes.filter((n) => n.id !== noteId) }
						: g,
				),
			);
			showToast("Note deleted.", "info");
		}
	};

	return (
		<main className="min-h-screen bg-[var(--bg)]">
			<div className="max-w-2xl mx-auto px-4 py-10">
				<h1 className="text-2xl font-semibold tracking-tight text-[var(--text)] mb-8">
					My Notebook
				</h1>

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
								className="h-32 rounded-2xl bg-[var(--surface-hover)]"
							/>
						))}
					</div>
				) : filteredGroups.length === 0 ? (
					<p className="text-[var(--text-muted)] text-sm text-center py-16">
						{groups.length === 0
							? "No notes yet — take one while listening and it'll show up here."
							: "Nothing matches that search."}
					</p>
				) : (
					<ul className="space-y-5">
						{filteredGroups.map((group) => {
							const isExpanded = expandedRaw.has(group.key);
							const isOrganizing = organizingKey === group.key;
							const isEditingThis =
								group.organizedNote && editingNoteId === group.organizedNote.id;

							return (
								<li
									key={group.key}
									className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-sm"
								>
									<div className="flex items-center justify-between mb-3">
										<h3 className="text-sm font-semibold text-[var(--text)] truncate pr-2">
											{group.episodeTitle}
										</h3>
										<span className="text-xs text-[var(--text-muted)] shrink-0">
											{group.notes.length} moment
											{group.notes.length !== 1 ? "s" : ""}
										</span>
									</div>

									{group.organizedNote ? (
										<div>
											{isEditingThis ? (
												<div className="space-y-2">
													<textarea
														value={editDraft}
														onChange={(e) => setEditDraft(e.target.value)}
														rows={10}
														className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)] font-mono"
													/>
													<div className="flex gap-2">
														<button
															onClick={() => saveOrganizedEdit(group)}
															disabled={savingEdit}
															className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-medium px-3.5 py-1.5 rounded-lg transition-colors"
														>
															{savingEdit ? "Saving…" : "Save"}
														</button>
														<button
															onClick={() => setEditingNoteId(null)}
															className="bg-[var(--surface-hover)] text-[var(--text)] text-xs font-medium px-3.5 py-1.5 rounded-lg"
														>
															Cancel
														</button>
													</div>
												</div>
											) : (
												<>
													{renderOrganizedNote(group.organizedNote.content)}
													<div className="flex gap-4 mt-3 pt-3 border-t border-[var(--border)]">
														<button
															onClick={() => startEditOrganized(group)}
															className="text-xs font-medium text-[var(--accent)] hover:opacity-80"
														>
															Edit
														</button>
														<button
															onClick={() => organizeGroup(group)}
															disabled={isOrganizing}
															className="text-xs font-medium text-[var(--accent)] hover:opacity-80"
														>
															{isOrganizing ? "Regenerating…" : "Regenerate"}
														</button>
														<button
															onClick={() => toggleRaw(group.key)}
															className="text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text)]"
														>
															{isExpanded ? "Hide" : "Show"} raw captures
														</button>
													</div>
												</>
											)}
										</div>
									) : (
										<button
											onClick={() => organizeGroup(group)}
											disabled={isOrganizing}
											className="text-sm font-medium text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)] px-4 py-2 rounded-xl transition-colors disabled:opacity-50 mb-3"
										>
											{isOrganizing ? "Organizing…" : "Organize into a note"}
										</button>
									)}

									{(isExpanded || !group.organizedNote) && (
										<ul className="space-y-3 mt-3">
											{group.notes.map((note) => {
												const hasListItems =
													Array.isArray(note.list_items) &&
													note.list_items.length > 0;
												const isListExpanded = expandedListIds.has(note.id);
												const visibleItems = hasListItems
													? isListExpanded
														? note.list_items!
														: note.list_items!.slice(0, 3)
													: [];

												return (
													<li
														key={note.id}
														className="bg-[var(--bg)] border border-[var(--border)] rounded-xl p-3.5"
													>
														<div className="flex justify-between items-start mb-1.5">
															<span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--accent)] bg-[var(--accent-soft)] px-2 py-0.5 rounded-md">
																{note.emotional_flag || "Note"}
															</span>
															<span className="font-mono text-[var(--text-muted)] text-xs">
																{formatTime(note.timestamp_seconds)}
															</span>
														</div>
														<p className="text-[var(--text)] text-sm font-medium leading-snug">
															{note.ai_summary}
														</p>
														{hasListItems && (
															<div className="mt-1.5">
																<ol className="pl-4 list-decimal text-xs text-[var(--text-muted)] space-y-0.5">
																	{visibleItems.map((item, i) => (
																		<li key={i}>{item}</li>
																	))}
																</ol>
																{note.list_items!.length > 3 && (
																	<button
																		onClick={() => toggleList(note.id)}
																		className="text-xs font-medium text-[var(--accent)] hover:opacity-80 mt-1"
																	>
																		{isListExpanded
																			? "Show less"
																			: `Show all ${note.list_items!.length}`}
																	</button>
																)}
															</div>
														)}
														{note.refined_quote && (
															<p className="text-[var(--text-muted)] text-xs italic mt-1.5 border-l-2 border-[var(--border)] pl-2">
																"{note.refined_quote}"
															</p>
														)}
														<button
															onClick={() => deleteRawNote(group, note.id)}
															className="text-xs font-medium text-[var(--danger)] hover:opacity-80 mt-2"
														>
															Delete
														</button>
													</li>
												);
											})}
										</ul>
									)}
								</li>
							);
						})}
					</ul>
				)}
			</div>
		</main>
	);
}

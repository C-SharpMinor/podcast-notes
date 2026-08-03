"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { useToast } from "@/components/Toast";

const GENRE_OPTIONS = [
	"Technology",
	"Business",
	"True Crime",
	"Comedy",
	"News & Politics",
	"Health & Fitness",
	"Education",
	"Sports",
	"Music",
	"Science",
	"History",
	"Arts & Culture",
	"Society & Culture",
	"Self-Improvement",
];

export default function SettingsPage() {
	const [userId, setUserId] = useState("");
	const [preferredGenres, setPreferredGenres] = useState<string[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [isSavingGenres, setIsSavingGenres] = useState(false);
	const [deletionRequested, setDeletionRequested] = useState(false);
	const { showToast } = useToast();
	const supabase = createClient();

	useEffect(() => {
		const load = async () => {
			const {
				data: { user },
			} = await supabase.auth.getUser();
			if (!user) return;
			setUserId(user.id);
			const { data: profile } = await supabase
				.from("profiles")
				.select("preferred_genres")
				.eq("id", user.id)
				.maybeSingle();
			setPreferredGenres(profile?.preferred_genres || []);
			setIsLoading(false);
		};
		load();
	}, []);

	const toggleGenre = (genre: string) =>
		setPreferredGenres((prev) =>
			prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre],
		);

	const saveGenres = async () => {
		setIsSavingGenres(true);
		const { error } = await supabase
			.from("profiles")
			.upsert({
				id: userId,
				preferred_genres: preferredGenres,
				updated_at: new Date().toISOString(),
			});
		setIsSavingGenres(false);
		showToast(
			error ? "Couldn't save preferences." : "Preferences saved.",
			error ? "error" : "success",
		);
	};

	const exportNotes = async () => {
		const [{ data: notes }, { data: episodeNotes }] = await Promise.all([
			supabase.from("user_notes").select("*"),
			supabase.from("episode_notes").select("*"),
		]);
		const blob = new Blob([JSON.stringify({ notes, episodeNotes }, null, 2)], {
			type: "application/json",
		});
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = "my-podcast-notes-export.json";
		a.click();
		URL.revokeObjectURL(url);
	};

	const requestDeletion = async () => {
		if (!confirm("This will queue your account for deletion — are you sure?"))
			return;
		await supabase.from("deletion_requests").insert({ user_id: userId });
		setDeletionRequested(true);
		showToast("Deletion requested — we'll process this shortly.", "info");
	};

	const handleSignOut = async () => {
		await supabase.auth.signOut();
	};

	if (isLoading) {
		return (
			<div className="max-w-xl mx-auto px-4 py-10 space-y-4 animate-pulse">
				{[...Array(4)].map((_, i) => (
					<div key={i} className="h-24 rounded-2xl bg-[var(--surface-hover)]" />
				))}
			</div>
		);
	}

	return (
		<div className="max-w-xl mx-auto px-4 py-10">
			<h1 className="text-2xl font-semibold tracking-tight text-[var(--text)] mb-8">
				Settings
			</h1>

			<section className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 mb-5 shadow-sm flex items-center justify-between">
				<div>
					<h2 className="text-sm font-semibold text-[var(--text)]">Account</h2>
					<p className="text-xs text-[var(--text-muted)] mt-1">
						Profile, password, avatar
					</p>
				</div>
				<Link
					href="/account"
					className="text-sm font-medium text-[var(--accent)] hover:opacity-80"
				>
					Manage →
				</Link>
			</section>

			<section className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 mb-5 shadow-sm">
				<h2 className="text-sm font-semibold text-[var(--text)] mb-1">
					Content preferences
				</h2>
				<p className="text-xs text-[var(--text-muted)] mb-4">
					Powers suggestions on the Discover page.
				</p>
				<div className="flex flex-wrap gap-2 mb-4">
					{GENRE_OPTIONS.map((genre) => {
						const selected = preferredGenres.includes(genre);
						return (
							<button
								key={genre}
								onClick={() => toggleGenre(genre)}
								className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${selected ? "bg-[var(--accent)] border-[var(--accent)] text-white" : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--accent)]/50"}`}
							>
								{genre}
							</button>
						);
					})}
				</div>
				<button
					onClick={saveGenres}
					disabled={isSavingGenres}
					className="text-sm font-medium text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)] px-4 py-2 rounded-xl transition-colors disabled:opacity-50"
				>
					{isSavingGenres ? "Saving…" : "Save preferences"}
				</button>
			</section>

			<section className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 mb-5 shadow-sm flex items-center justify-between">
				<div>
					<h2 className="text-sm font-semibold text-[var(--text)]">
						Subscription
					</h2>
					<p className="text-xs text-[var(--text-muted)] mt-1">
						You're on the Free plan
					</p>
				</div>
				<Link
					href="/pricing"
					className="text-sm font-medium text-[var(--accent)] hover:opacity-80"
				>
					View plans →
				</Link>
			</section>

			<section className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 mb-5 shadow-sm">
				<h2 className="text-sm font-semibold text-[var(--text)] mb-1">
					Data & privacy
				</h2>
				<p className="text-xs text-[var(--text-muted)] mb-4">
					Export everything you've captured, or request account deletion.
				</p>
				<div className="flex flex-wrap gap-3">
					<button
						onClick={exportNotes}
						className="text-sm font-medium border border-[var(--border)] hover:bg-[var(--surface-hover)] text-[var(--text)] px-4 py-2 rounded-xl transition-colors"
					>
						Export my notes
					</button>
					<button
						onClick={requestDeletion}
						disabled={deletionRequested}
						className="text-sm font-medium text-[var(--danger)] border border-[var(--danger)]/30 hover:bg-[var(--danger)]/10 px-4 py-2 rounded-xl transition-colors disabled:opacity-50"
					>
						{deletionRequested
							? "Deletion requested"
							: "Request account deletion"}
					</button>
				</div>
			</section>

			<section className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 mb-5 shadow-sm">
				<h2 className="text-sm font-semibold text-[var(--text)] mb-1">About</h2>
				<p className="text-xs text-[var(--text-muted)] mb-3">
					AI Podcast Notes — early access
				</p>
				<Link
					href="/mobile-app"
					className="text-sm font-medium text-[var(--accent)] hover:opacity-80"
				>
					Learn about the mobile app →
				</Link>
			</section>

			<button
				onClick={handleSignOut}
				className="w-full text-sm font-medium text-[var(--danger)] border border-[var(--danger)]/30 hover:bg-[var(--danger)]/10 py-2.5 rounded-xl transition-colors"
			>
				Sign out
			</button>
		</div>
	);
}

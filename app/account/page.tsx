"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { useToast } from "@/components/Toast";
import PasswordInput from "@/components/PasswordInput";
import LoadingOverlay from "@/components/LoadingOverlay";

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

export default function AccountPage() {
	const [userId, setUserId] = useState("");
	const [email, setEmail] = useState("");
	const [displayName, setDisplayName] = useState("");
	const [bio, setBio] = useState("");
	const [avatarUrl, setAvatarUrl] = useState("");
	const [preferredGenres, setPreferredGenres] = useState<string[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [isSaving, setIsSaving] = useState(false);
	const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
	const [newPassword, setNewPassword] = useState("");
	const [isChangingPassword, setIsChangingPassword] = useState(false);

	const { showToast } = useToast();
	const supabase = createClient();

	useEffect(() => {
		const load = async () => {
			const {
				data: { user },
			} = await supabase.auth.getUser();
			if (!user) return;
			setUserId(user.id);
			setEmail(user.email || "");

			const { data: profile } = await supabase
				.from("profiles")
				.select("*")
				.eq("id", user.id)
				.maybeSingle();
			if (profile) {
				setDisplayName(profile.display_name || "");
				setBio(profile.bio || "");
				setAvatarUrl(profile.avatar_url || "");
				setPreferredGenres(profile.preferred_genres || []);
			}
			setIsLoading(false);
		};
		load();
	}, []);

	const toggleGenre = (genre: string) => {
		setPreferredGenres((prev) =>
			prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre],
		);
	};

	const saveProfile = async () => {
		setIsSaving(true);
		try {
			const { error } = await supabase.from("profiles").upsert({
				id: userId,
				display_name: displayName,
				bio,
				avatar_url: avatarUrl,
				preferred_genres: preferredGenres,
				updated_at: new Date().toISOString(),
			});
			if (error) throw error;
			showToast("Profile updated.", "success");
		} catch {
			showToast("Couldn't save your profile.", "error");
		} finally {
			setIsSaving(false);
		}
	};

	const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file || !userId) return;

		if (file.size > 5 * 1024 * 1024) {
			showToast("Please pick an image under 5MB.", "error");
			return;
		}

		setIsUploadingAvatar(true);
		try {
			const ext = file.name.split(".").pop();
			const path = `${userId}/avatar.${ext}`;
			const { error: uploadError } = await supabase.storage
				.from("avatars")
				.upload(path, file, { upsert: true });
			if (uploadError) throw uploadError;

			const { data } = supabase.storage.from("avatars").getPublicUrl(path);
			setAvatarUrl(`${data.publicUrl}?t=${Date.now()}`);
			showToast("Profile picture updated — remember to save.", "success");
		} catch {
			showToast("Couldn't upload that image.", "error");
		} finally {
			setIsUploadingAvatar(false);
		}
	};

	const handlePasswordChange = async (e: React.FormEvent) => {
		e.preventDefault();
		if (newPassword.length < 6) {
			showToast("Password must be at least 6 characters.", "error");
			return;
		}
		setIsChangingPassword(true);
		try {
			const { error } = await supabase.auth.updateUser({
				password: newPassword,
			});
			if (error) throw error;
			showToast("Password updated.", "success");
			setNewPassword("");
		} catch (err: any) {
			showToast(err.message || "Couldn't update password.", "error");
		} finally {
			setIsChangingPassword(false);
		}
	};

	if (isLoading) {
		return (
			<div className="max-w-xl mx-auto px-4 py-10 space-y-4 animate-pulse">
				<div className="h-8 w-40 rounded bg-[var(--surface-hover)]" />
				<div className="h-32 rounded-2xl bg-[var(--surface-hover)]" />
				<div className="h-48 rounded-2xl bg-[var(--surface-hover)]" />
			</div>
		);
	}

	return (
		<div className="max-w-xl mx-auto px-4 py-10">
			<h1 className="text-2xl font-semibold tracking-tight text-[var(--text)] mb-8">
				Account
			</h1>

			<section className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 mb-6 shadow-sm">
				<h2 className="text-sm font-semibold text-[var(--text-muted)] mb-4">
					Profile
				</h2>
				<div className="flex items-center gap-4 mb-5">
					<div className="w-16 h-16 rounded-full overflow-hidden bg-[var(--bg)] border border-[var(--border)] flex items-center justify-center shrink-0">
						{avatarUrl ? (
							// eslint-disable-next-line @next/next/no-img-element
							<img
								src={avatarUrl}
								alt=""
								className="w-full h-full object-cover"
							/>
						) : (
							<span className="text-[var(--text-muted)] text-xl">
								{displayName?.[0]?.toUpperCase() ||
									email[0]?.toUpperCase() ||
									"?"}
							</span>
						)}
					</div>
					<label className="text-sm font-medium text-[var(--accent)] hover:opacity-80 cursor-pointer">
						{isUploadingAvatar ? "Uploading…" : "Change photo"}
						<input
							type="file"
							accept="image/*"
							className="hidden"
							disabled={isUploadingAvatar}
							onChange={handleAvatarChange}
						/>
					</label>
				</div>

				<div className="space-y-4">
					<div>
						<label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">
							Display name
						</label>
						<input
							value={displayName}
							onChange={(e) => setDisplayName(e.target.value)}
							className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3.5 py-2.5 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/30 transition"
							placeholder="Your name"
						/>
					</div>
					<div>
						<label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">
							Bio
						</label>
						<textarea
							value={bio}
							onChange={(e) => setBio(e.target.value)}
							rows={3}
							maxLength={280}
							className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3.5 py-2.5 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/30 transition"
							placeholder="A little about what you listen to"
						/>
					</div>
					<div>
						<label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">
							Email
						</label>
						<input
							value={email}
							disabled
							className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-hover)] px-3.5 py-2.5 text-sm text-[var(--text-muted)]"
						/>
					</div>
				</div>
			</section>

			<section className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 mb-6 shadow-sm">
				<h2 className="text-sm font-semibold text-[var(--text-muted)] mb-1">
					Content preferences
				</h2>
				<p className="text-xs text-[var(--text-muted)] mb-4">
					Used to shape suggestions on the Discover page. Change these anytime.
				</p>
				<div className="flex flex-wrap gap-2">
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
			</section>

			<button
				onClick={saveProfile}
				disabled={isSaving}
				className="w-full rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-sm font-medium py-2.5 transition-colors disabled:opacity-50 mb-6"
			>
				{isSaving ? "Saving…" : "Save changes"}
			</button>

			<section className="relative bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 shadow-sm">
				<LoadingOverlay show={isChangingPassword} />
				<h2 className="text-sm font-semibold text-[var(--text-muted)] mb-4">
					Change password
				</h2>
				<form onSubmit={handlePasswordChange} className="space-y-3">
					<PasswordInput
						value={newPassword}
						onChange={setNewPassword}
						placeholder="New password"
						disabled={isChangingPassword}
						autoComplete="new-password"
					/>
					<button
						type="submit"
						disabled={isChangingPassword}
						className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] text-[var(--text)] text-sm font-medium py-2.5 transition-colors disabled:opacity-50"
					>
						Update password
					</button>
				</form>
			</section>
		</div>
	);
}

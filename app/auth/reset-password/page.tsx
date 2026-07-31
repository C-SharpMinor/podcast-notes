"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import PasswordInput from "@/components/PasswordInput";
import LoadingOverlay from "@/components/LoadingOverlay";
import ThemeToggle from "@/components/ThemeToggle";

export default function ResetPasswordPage() {
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [loading, setLoading] = useState(false);
	const [message, setMessage] = useState<{
		type: "error";
		text: string;
	} | null>(null);
	const [done, setDone] = useState(false);
	const router = useRouter();
	const supabase = createClient();

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setMessage(null);

		if (password !== confirmPassword) {
			setMessage({ type: "error", text: "Passwords don't match." });
			return;
		}

		setLoading(true);
		const { error } = await supabase.auth.updateUser({ password });
		setLoading(false);

		if (error) {
			setMessage({ type: "error", text: error.message });
		} else {
			setDone(true);
			setTimeout(() => router.push("/"), 2000);
		}
	};

	return (
		<div className="relative min-h-screen flex items-center justify-center overflow-hidden px-4 bg-[var(--bg)]">
			<div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-[var(--accent)]/20 blur-[100px]" />
			<div className="absolute -bottom-24 -right-24 w-96 h-96 rounded-full bg-[var(--accent)]/10 blur-[100px]" />
			<div className="absolute top-6 right-6 z-10">
				<ThemeToggle />
			</div>

			<div className="relative z-10 w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--surface)]/70 backdrop-blur-xl shadow-2xl p-8">
				<LoadingOverlay show={loading} />

				{done ? (
					<div className="text-center">
						<h1 className="text-2xl font-semibold tracking-tight text-[var(--text)] mb-2">
							Password updated
						</h1>
						<p className="text-sm text-[var(--text-muted)]">
							Taking you back to log in…
						</p>
					</div>
				) : (
					<>
						<div className="mb-8 text-center">
							<h1 className="text-2xl font-semibold tracking-tight text-[var(--text)]">
								Set a new password
							</h1>
							<p className="text-sm text-[var(--text-muted)] mt-1.5">
								Choose something you haven't used before.
							</p>
						</div>

						{message && (
							<div className="mb-5 px-3.5 py-2.5 rounded-xl text-sm text-center bg-[var(--danger)]/10 border border-[var(--danger)]/30 text-[var(--danger)]">
								{message.text}
							</div>
						)}

						<form onSubmit={handleSubmit} className="space-y-4">
							<div>
								<label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">
									New password
								</label>
								<PasswordInput
									value={password}
									onChange={setPassword}
									disabled={loading}
									autoComplete="new-password"
								/>
							</div>
							<div>
								<label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">
									Confirm password
								</label>
								<PasswordInput
									value={confirmPassword}
									onChange={setConfirmPassword}
									disabled={loading}
									autoComplete="new-password"
									placeholder="Confirm password"
								/>
							</div>
							<button
								type="submit"
								disabled={loading}
								className="w-full rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-sm font-medium py-2.5 transition-colors disabled:opacity-50"
							>
								Update password
							</button>
						</form>
					</>
				)}
			</div>
		</div>
	);
}

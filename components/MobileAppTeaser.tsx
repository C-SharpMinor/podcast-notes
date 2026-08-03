import Link from "next/link";

export default function MobileAppTeaser() {
	return (
		<div className="mt-16 mb-4 text-left rounded-2xl border border-[var(--accent)]/20 bg-[var(--accent-soft)]/40 p-5 flex items-center justify-between gap-4 flex-wrap">
			<div>
				<p className="text-sm font-semibold text-[var(--text)]">
					There's a mobile app coming to Google Play
				</p>
				<p className="text-xs text-[var(--text-muted)] mt-1">
					Hands-free note-taking that listens for you, even with your phone in
					your pocket.
				</p>
			</div>
			<Link
				href="/mobile-app"
				className="text-sm font-medium text-[var(--accent)] hover:underline shrink-0"
			>
				More information →
			</Link>
		</div>
	);
}

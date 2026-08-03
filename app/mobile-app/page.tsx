import Link from "next/link";

const FEATURES = [
	{
		feature: "Play RSS podcasts, YouTube, and your own files",
		web: true,
		mobile: true,
	},
	{
		feature: "AI-refined notes grounded in the real transcript",
		web: true,
		mobile: true,
	},
	{ feature: "Suggested highlights per episode", web: true, mobile: true },
	{
		feature: "Note-taking trigger",
		web: "Tap and hold",
		mobile: "Say 'note that point' — hands-free",
	},
	{
		feature: "Works with your phone locked or in your pocket",
		web: false,
		mobile: true,
	},
	{
		feature: "Keeps listening while you use other apps",
		web: false,
		mobile: true,
	},
];

export default function MobileAppPage() {
	return (
		<div className="max-w-2xl mx-auto px-4 py-10">
			<Link
				href="/"
				className="text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
			>
				← Back
			</Link>
			<h1 className="text-3xl font-semibold tracking-tight text-[var(--text)] mt-4 mb-3">
				The mobile app does more
			</h1>
			<p className="text-[var(--text-muted)] mb-10 leading-relaxed">
				The web app is genuinely good for browsing and reviewing your notes. But
				the core promise — never lose a thought because your hands are busy —
				only really works when the app can hear you without you touching your
				phone. That needs a real native app.
			</p>

			<div className="rounded-2xl border border-[var(--border)] overflow-hidden mb-10">
				<table className="w-full text-sm">
					<thead>
						<tr className="bg-[var(--surface)] border-b border-[var(--border)]">
							<th className="text-left font-medium text-[var(--text-muted)] px-4 py-3">
								Feature
							</th>
							<th className="text-center font-medium text-[var(--text-muted)] px-4 py-3">
								Web
							</th>
							<th className="text-center font-medium text-[var(--accent)] px-4 py-3">
								Mobile
							</th>
						</tr>
					</thead>
					<tbody>
						{FEATURES.map((row, i) => (
							<tr
								key={i}
								className="border-b border-[var(--border)] last:border-0 bg-[var(--bg)]"
							>
								<td className="px-4 py-3 text-[var(--text)]">{row.feature}</td>
								<td className="px-4 py-3 text-center">
									{typeof row.web === "boolean" ? (
										row.web ? (
											"✓"
										) : (
											<span className="text-[var(--text-muted)]">—</span>
										)
									) : (
										<span className="text-xs text-[var(--text-muted)]">
											{row.web}
										</span>
									)}
								</td>
								<td className="px-4 py-3 text-center">
									{typeof row.mobile === "boolean" ? (
										row.mobile ? (
											<span className="text-[var(--accent)] font-medium">
												✓
											</span>
										) : (
											"—"
										)
									) : (
										<span className="text-xs text-[var(--accent)] font-medium">
											{row.mobile}
										</span>
									)}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>

			<div className="rounded-2xl bg-[var(--accent-soft)] border border-[var(--accent)]/20 p-6 text-center">
				<p className="text-sm font-medium text-[var(--text)] mb-1">
					Not on Google Play yet
				</p>
				<p className="text-xs text-[var(--text-muted)]">
					We'll let existing web users know the moment it's out — just keep
					using the web app for now.
				</p>
			</div>
		</div>
	);
}

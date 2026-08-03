const PLANS = [
	{
		name: "Free",
		price: "$0",
		period: "forever",
		description: "Try the core loop",
		features: [
			"Up to 20 notes / month",
			"RSS, YouTube, and uploads",
			"Manual hold-to-note capture",
			"Personal Notebook",
		],
		cta: "Current plan",
		highlighted: false,
	},
	{
		name: "Web Pro",
		price: "$6.99",
		period: "/ month",
		description: "For regular listeners",
		features: [
			"Unlimited notes",
			"Suggested highlights per episode",
			"Personalized jotting style",
			"Priority transcript processing",
		],
		cta: "Upgrade",
		highlighted: true,
	},
	{
		name: "Mobile Pro",
		price: "$4.99",
		period: "/ month",
		description: "Everything in Web Pro, hands-free",
		features: [
			"Everything in Web Pro",
			"Always-listening wake word",
			"Works with your phone locked",
			"Background capture",
		],
		cta: "Available on Google Play",
		highlighted: false,
		badge: "Best value",
	},
];

export default function PricingPage() {
	return (
		<div className="max-w-4xl mx-auto px-4 py-10">
			<div className="text-center mb-10">
				<h1 className="text-3xl font-semibold tracking-tight text-[var(--text)] mb-3">
					Pricing
				</h1>
				<p className="text-[var(--text-muted)] max-w-lg mx-auto leading-relaxed">
					Mobile Pro costs less than Web Pro — the mobile app does more, and
					we'd rather pass the savings on than let price be a reason not to
					switch.
				</p>
			</div>
			<div className="grid sm:grid-cols-3 gap-5">
				{PLANS.map((plan) => (
					<div
						key={plan.name}
						className={`relative rounded-2xl border p-6 flex flex-col ${plan.highlighted ? "border-[var(--accent)] bg-[var(--accent-soft)]/40 shadow-md" : "border-[var(--border)] bg-[var(--surface)] shadow-sm"}`}
					>
						{plan.badge && (
							<span className="absolute -top-3 left-6 text-[10px] font-semibold uppercase tracking-wide bg-[var(--accent)] text-white px-2.5 py-1 rounded-full">
								{plan.badge}
							</span>
						)}
						<h2 className="text-lg font-semibold text-[var(--text)] mb-1">
							{plan.name}
						</h2>
						<p className="text-xs text-[var(--text-muted)] mb-4">
							{plan.description}
						</p>
						<div className="mb-5">
							<span className="text-3xl font-semibold text-[var(--text)]">
								{plan.price}
							</span>
							<span className="text-sm text-[var(--text-muted)]">
								{" "}
								{plan.period}
							</span>
						</div>
						<ul className="space-y-2 mb-6 flex-1">
							{plan.features.map((f, i) => (
								<li
									key={i}
									className="text-sm text-[var(--text)] flex items-start gap-2"
								>
									<span className="text-[var(--accent)] mt-0.5">✓</span>
									{f}
								</li>
							))}
						</ul>
						<button
							className={`w-full rounded-xl text-sm font-medium py-2.5 transition-colors ${plan.highlighted ? "bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white" : "border border-[var(--border)] hover:bg-[var(--surface-hover)] text-[var(--text)]"}`}
						>
							{plan.cta}
						</button>
					</div>
				))}
			</div>
		</div>
	);
}

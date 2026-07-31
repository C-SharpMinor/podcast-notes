"use client";

interface ChoiceModalProps {
	isOpen: boolean;
	onClose: () => void;
	onConfirm: (choice: "play" | "list") => void;
	podcastData: any;
}

export default function ChoiceModal({
	isOpen,
	onClose,
	onConfirm,
	podcastData,
}: ChoiceModalProps) {
	if (!isOpen || !podcastData) return null;

	const title = podcastData.trackName || podcastData.collectionName;
	const artwork = podcastData.artworkUrl600 || podcastData.artworkUrl100;

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center p-4">
			<div
				className="absolute inset-0 bg-black/50 backdrop-blur-sm"
				onClick={onClose}
			/>
			<div className="relative w-full max-w-sm bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-2xl p-6 animate-in fade-in zoom-in-95 duration-200">
				<div className="flex items-center gap-3 mb-5">
					{/* eslint-disable-next-line @next/next/no-img-element */}
					{artwork && (
						<img
							src={artwork}
							alt=""
							className="w-12 h-12 rounded-xl shadow-sm"
						/>
					)}
					<div className="overflow-hidden">
						<p className="font-medium text-sm text-[var(--text)] truncate">
							{title}
						</p>
						<p className="text-xs text-[var(--text-muted)] truncate">
							{podcastData.collectionName}
						</p>
					</div>
				</div>

				<div className="space-y-2">
					<button
						onClick={() => onConfirm("play")}
						className="w-full rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-sm font-medium py-2.5 transition-colors"
					>
						Play this episode
					</button>
					<button
						onClick={() => onConfirm("list")}
						className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] text-[var(--text)] text-sm font-medium py-2.5 transition-colors"
					>
						Browse all episodes
					</button>
				</div>

				<button
					onClick={onClose}
					className="absolute top-4 right-4 text-[var(--text-muted)] hover:text-[var(--text)]"
					aria-label="Close"
				>
					✕
				</button>
			</div>
		</div>
	);
}

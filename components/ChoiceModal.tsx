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

	return (
		<div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200">
			<div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl max-w-sm w-full shadow-2xl text-center scale-up-center">
				{/* Artwork */}
				<div className="relative w-32 h-32 mx-auto mb-6">
					{/* eslint-disable-next-line @next/next/no-img-element */}
					<img
						// This checks for the biggest image first, then falls back to smaller ones
						src={
							podcastData.artworkUrl600 ||
							podcastData.artworkUrl100 ||
							podcastData.artworkUrl60
						}
						alt={podcastData.trackName || "cover"}
						className="w-full h-full rounded-2xl shadow-2xl border border-slate-700 object-cover"
						// Handle broken links by hiding the broken icon
						onError={(e) => {
							(e.target as HTMLImageElement).src =
								"https://via.placeholder.com/150?text=No+Image";
						}}
					/>
					<div className="absolute -bottom-2 -right-2 bg-blue-600 rounded-full p-1.5 shadow-lg">
						<svg
							className="w-5 h-5 text-white"
							fill="currentColor"
							viewBox="0 0 20 20"
						>
							<path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" />
						</svg>
					</div>
				</div>

				<h3 className="text-white font-extrabold text-xl mb-2 line-clamp-2">
					{podcastData.trackName || podcastData.collectionName}
				</h3>
				<p className="text-gray-400 text-sm mb-8 px-2">
					{podcastData.wrapperType === "podcastEpisode"
						? `Found a specific episode from "${podcastData.collectionName}". How do you want to proceed?`
						: "Would you like to jump into the latest episode or browse the full list?"}
				</p>

				<div className="flex flex-col gap-3">
					<button
						onClick={() => onConfirm("play")}
						className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-2xl transition-all active:scale-95 shadow-lg shadow-blue-900/20"
					>
						Play Episode Now
					</button>
					<button
						onClick={() => onConfirm("list")}
						className="w-full bg-slate-800 hover:bg-slate-700 text-gray-200 font-semibold py-4 rounded-2xl transition-all active:scale-95"
					>
						View Episode List
					</button>
					<button
						onClick={onClose}
						className="mt-4 text-gray-500 hover:text-white text-sm font-medium transition"
					>
						Maybe Later
					</button>
				</div>
			</div>
		</div>
	);
}

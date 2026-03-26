import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
	return {
		name: "AI Podcast Notes",
		short_name: "AI Notes",
		description: "Voice-activated podcast note-taking",
		start_url: "/",
		display: "standalone", // This is the magic word that removes the Safari/Chrome address bar
		background_color: "#020617", // Matches Tailwind slate-950
		theme_color: "#020617",
		icons: [
			{
				src: "/icon-192x192.png",
				sizes: "192x192",
				type: "image/png",
			},
			{
				src: "/icon-512x512.png",
				sizes: "512x512",
				type: "image/png",
			},
		],
	};
}

import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
	title: "AI Podcast Notes",
	description: "Voice-activated podcast note-taking",
};

export const viewport: Viewport = {
	themeColor: "#020617",
	width: "device-width",
	initialScale: 1,
	maximumScale: 1, // Prevents annoying double-tap zooming on iPhones
	userScalable: false,
};

export default function RootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		// Adding suppressHydrationWarning here
		<html lang="en" suppressHydrationWarning>
			<body className={inter.className} suppressHydrationWarning>
				{children}
			</body>
		</html>
	);
}

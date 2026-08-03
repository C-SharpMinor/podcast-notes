import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ToastProvider } from "@/components/Toast";
import AppShell from "@/components/AppShell";

export const metadata: Metadata = {
	title: "AI Podcast Notes",
	description: "Voice-activated podcast note-taking",
};

export default function RootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<html
			lang="en"
			className={`${GeistSans.variable} ${GeistMono.variable}`}
			suppressHydrationWarning
		>
			<body>
				<ThemeProvider>
					<ToastProvider>
						<AppShell>{children}</AppShell>
					</ToastProvider>
				</ThemeProvider>
			</body>
		</html>
	);
}

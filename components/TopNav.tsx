"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import ThemeToggle from "@/components/ThemeToggle";

const NAV_LINKS = [
	{ href: "/", label: "Home" },
	{ href: "/notebook", label: "Notebook" },
	{ href: "/suggestions", label: "Discover" },
	{ href: "/pricing", label: "Pricing" },
	{ href: "/settings", label: "Settings" },
];

export default function TopNav({ userEmail }: { userEmail?: string }) {
	const pathname = usePathname();
	const [avatarUrl, setAvatarUrl] = useState("");
	const [displayName, setDisplayName] = useState("");

	useEffect(() => {
		const load = async () => {
			const supabase = createClient();
			const {
				data: { user },
			} = await supabase.auth.getUser();
			if (!user) return;
			const { data: profile } = await supabase
				.from("profiles")
				.select("avatar_url, display_name")
				.eq("id", user.id)
				.maybeSingle();
			if (profile) {
				setAvatarUrl(profile.avatar_url || "");
				setDisplayName(profile.display_name || "");
			}
		};
		load();
	}, []);

	return (
		<header className="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--bg)]/90 backdrop-blur-md">
			<div className="max-w-4xl mx-auto flex items-center justify-between px-4 py-3.5">
				<nav className="flex items-center gap-1 overflow-x-auto">
					{NAV_LINKS.map((link) => {
						const active = pathname === link.href;
						return (
							<Link
								key={link.href}
								href={link.href}
								className={`text-sm font-medium px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${active ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "text-[var(--text-muted)] hover:text-[var(--text)]"}`}
							>
								{link.label}
							</Link>
						);
					})}
				</nav>
				<div className="flex items-center gap-3 shrink-0">
					<ThemeToggle />
					<Link
						href="/account"
						className="w-8 h-8 rounded-full overflow-hidden bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center hover:border-[var(--accent)] transition-colors"
						aria-label="Account"
					>
						{avatarUrl ? (
							// eslint-disable-next-line @next/next/no-img-element
							<img
								src={avatarUrl}
								alt=""
								className="w-full h-full object-cover"
							/>
						) : (
							<span className="text-xs font-medium text-[var(--text-muted)]">
								{displayName?.[0]?.toUpperCase() ||
									userEmail?.[0]?.toUpperCase() ||
									"?"}
							</span>
						)}
					</Link>
				</div>
			</div>
		</header>
	);
}

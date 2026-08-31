"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { PlayerProvider } from "@/contexts/PlayerContext";
import TopNav from "@/components/TopNav";
import GlobalPlayerBar from "@/components/GlobalPlayerBar";
import Footer from "@/components/Footer";
import Auth from "@/components/Auth";

export default function AppShell({ children }: { children: React.ReactNode }) {
	const [session, setSession] = useState<any>(null);
	const [loaded, setLoaded] = useState(false);
	const pathname = usePathname();
	const supabase = createClient();

	useEffect(() => {
		supabase.auth.getSession().then(({ data: { session } }) => {
			setSession(session);
			setLoaded(true);
		});
		const {
			data: { subscription },
		} = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
		return () => subscription.unsubscribe();
	}, []);

	const handleLogout = async () => {
		await supabase.auth.signOut();
	};

	// The password-reset landing page gets its own frosted standalone screen — skip the
	// normal app shell/nav even though a recovery session technically counts as "logged in."
	if (pathname?.startsWith("/auth/reset-password")) {
		return <>{children}</>;
	}

	if (!loaded) return null;
	if (!session) return <Auth onLogin={() => {}} />;

	return (
		<PlayerProvider userId={session.user.id}>
			<TopNav userEmail={session.user.email} />{" "}
			<div className="pb-24 min-h-[calc(100vh-4rem)]">{children}
				<Footer />
			</div>
			<GlobalPlayerBar />
		</PlayerProvider>
	);
}

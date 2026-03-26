"use client";

import posthog from "posthog-js";
import { PostHogProvider } from "posthog-js/react";
import { useEffect } from "react";

export default function CSPostHogProvider({
	children,
}: {
	children: React.ReactNode;
}) {
	useEffect(() => {
		posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY as string, {
			api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
			person_profiles: "identified_only", // Keeps the free tier usage low
		});
	}, []);

	return <PostHogProvider client={posthog}>{children}</PostHogProvider>;
}

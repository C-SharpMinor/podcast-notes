import { NextResponse } from "next/server";
// This uses your server-side Supabase client to securely establish the session
import { createClient } from "@/utils/supabase/server";

export async function GET(request: Request) {
	const { searchParams, origin } = new URL(request.url);
	const code = searchParams.get("code");

	// If there's a specific page they were trying to access, redirect them there. Otherwise, go to home '/'
	const next = searchParams.get("next") ?? "/";

	if (code) {
		const supabase = await createClient();
		const { error } = await supabase.auth.exchangeCodeForSession(code);

		if (!error) {
			// Success! Send them to the app.
			return NextResponse.redirect(`${origin}${next}`);
		} else {
			console.error("Auth Callback Error:", error.message);
		}
	}

	// If there was no code or an error occurred, send them back to the login page with an error parameter
	return NextResponse.redirect(`${origin}/?error=auth_failed`);
}

import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { looseRatelimit } from "@/utils/ratelimit";

export async function POST(req: Request) {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user)
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const { success } = await looseRatelimit.limit(user.id);
	if (!success)
		return NextResponse.json(
			{ error: "Too many requests, slow down." },
			{ status: 429 },
		);

	const { episodeNoteId, content } = await req.json();
	if (!episodeNoteId || typeof content !== "string") {
		return NextResponse.json(
			{ error: "episodeNoteId and content are required" },
			{ status: 400 },
		);
	}

	const { data: existing, error: fetchErr } = await supabase
		.from("episode_notes")
		.select("content")
		.eq("id", episodeNoteId)
		.eq("user_id", user.id)
		.maybeSingle();

	if (fetchErr || !existing)
		return NextResponse.json({ error: "Note not found" }, { status: 404 });

	const { error: updateErr } = await supabase
		.from("episode_notes")
		.update({ content, updated_at: new Date().toISOString() })
		.eq("id", episodeNoteId)
		.eq("user_id", user.id);

	if (updateErr)
		return NextResponse.json(
			{ error: "Failed to update note" },
			{ status: 500 },
		);

	if (existing.content !== content) {
		await supabase.from("note_edits").insert({
			user_id: user.id,
			note_id: episodeNoteId,
			field: "organized_note",
			original_value: existing.content,
			edited_value: content,
		});
	}

	return NextResponse.json({ success: true });
}

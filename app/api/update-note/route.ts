import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function POST(req: Request) {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user)
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const { noteId, summary, refined_quote, emotional_flag } = await req.json();
	if (!noteId)
		return NextResponse.json({ error: "noteId is required" }, { status: 400 });

	const { data: existing, error: fetchErr } = await supabase
		.from("user_notes")
		.select("ai_summary, refined_quote, emotional_flag")
		.eq("id", noteId)
		.eq("user_id", user.id)
		.maybeSingle();

	if (fetchErr || !existing) {
		return NextResponse.json({ error: "Note not found" }, { status: 404 });
	}

	const { error: updateErr } = await supabase
		.from("user_notes")
		.update({ ai_summary: summary, refined_quote, emotional_flag })
		.eq("id", noteId)
		.eq("user_id", user.id);

	if (updateErr) {
		return NextResponse.json(
			{ error: "Failed to update note" },
			{ status: 500 },
		);
	}

	const diffs = [
		{ field: "summary", before: existing.ai_summary, after: summary },
		{
			field: "refined_quote",
			before: existing.refined_quote,
			after: refined_quote,
		},
		{
			field: "emotional_flag",
			before: existing.emotional_flag,
			after: emotional_flag,
		},
	].filter((d) => d.before !== d.after);

	if (diffs.length > 0) {
		await supabase.from("note_edits").insert(
			diffs.map((d) => ({
				user_id: user.id,
				note_id: noteId,
				field: d.field,
				original_value: d.before,
				edited_value: d.after,
			})),
		);
	}

	return NextResponse.json({ success: true });
}

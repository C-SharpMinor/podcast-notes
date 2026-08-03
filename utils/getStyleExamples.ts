import { SupabaseClient } from "@supabase/supabase-js";

export async function getUserStyleExamples(
	supabase: SupabaseClient,
	userId: string,
	limit = 6,
): Promise<string> {
	const { data, error } = await supabase
		.from("note_edits")
		.select("field, original_value, edited_value")
		.eq("user_id", userId)
		.order("created_at", { ascending: false })
		.limit(limit);

	if (error || !data || data.length === 0) return "";

	const lines = data
		.filter(
			(e) =>
				e.original_value &&
				e.edited_value &&
				e.original_value !== e.edited_value,
		)
		.map(
			(e) =>
				`- For "${e.field}": AI wrote "${e.original_value}" → the user changed it to "${e.edited_value}"`,
		);

	if (lines.length === 0) return "";

	return `This user has previously edited AI-generated notes like this. Match their preferred style where it reasonably applies, without forcing it:\n${lines.join("\n")}`;
}

export async function getOrganizedNoteStyleExample(
	supabase: SupabaseClient,
	userId: string,
): Promise<string> {
	const { data, error } = await supabase
		.from("note_edits")
		.select("edited_value")
		.eq("user_id", userId)
		.eq("field", "organized_note")
		.order("created_at", { ascending: false })
		.limit(1)
		.maybeSingle();

	if (error || !data?.edited_value) return "";

	return `Here is an example of a note this user personally edited into their preferred final form in the past. Match its general tone, structure, and level of detail where reasonable:\n"""\n${data.edited_value}\n"""`;
}

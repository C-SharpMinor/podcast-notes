import { SupabaseClient } from "@supabase/supabase-js";

interface ResolveEpisodeParams {
	sourceType: "rss" | "youtube" | "upload";
	sourceTitle: string;
	sourceUrl: string;
	authorName?: string;
	episodeTitle: string;
	episodeAudioUrl: string; // must be a STABLE identifier — never an ephemeral signed URL
	durationSeconds?: number;
}

export async function resolveEpisodeId(
	supabase: SupabaseClient,
	params: ResolveEpisodeParams,
): Promise<string | null> {
	try {
		const { data: source, error: sourceErr } = await supabase
			.from("audio_sources")
			.upsert(
				{
					source_type: params.sourceType,
					title: params.sourceTitle,
					url: params.sourceUrl,
					author_name: params.authorName || null,
				},
				{ onConflict: "url" },
			)
			.select("id")
			.single();

		if (sourceErr || !source) {
			console.error("Failed to resolve audio_source:", sourceErr?.message);
			return null;
		}

		const { data: episode, error: episodeErr } = await supabase
			.from("episodes")
			.upsert(
				{
					audio_source_id: source.id,
					title: params.episodeTitle,
					audio_url: params.episodeAudioUrl,
					duration_seconds: params.durationSeconds ?? null,
				},
				{ onConflict: "audio_url" },
			)
			.select("id")
			.single();

		if (episodeErr || !episode) {
			console.error("Failed to resolve episode:", episodeErr?.message);
			return null;
		}

		return episode.id;
	} catch (err) {
		console.error("resolveEpisodeId failed:", err);
		return null;
	}
}

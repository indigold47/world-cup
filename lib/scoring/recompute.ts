/**
 * Calls the SQL `recompute_scores()` RPC, which is the actual scoring engine.
 *
 * The pure JS scoring functions live in ./score.ts and ./standings.ts — they
 * encode the same rules, but the live recompute happens in SQL so a single
 * round-trip can rewrite every prediction's .points without N×players
 * sequential UPDATE statements.
 */

import { createClient } from "@/lib/supabase/server";

export async function recomputeScores(): Promise<{
  ok: boolean;
  error?: string;
}> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("recompute_scores");
  if (error) {
    // Surface but don't throw — admin save flows can continue and the admin
    // can retry; throwing here would leave the match result saved but the
    // admin UI showing a hard error.
    console.error("recompute_scores failed:", error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

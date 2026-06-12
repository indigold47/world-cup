"use server";

import { createClient } from "@/lib/supabase/server";

export type SavePredictionResult =
  | { ok: true }
  | { ok: false; error: string };

const MAX_GOALS = 20;

function isValidGoal(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= MAX_GOALS;
}

export async function saveMatchPrediction(
  matchId: number,
  homeGoals: number,
  awayGoals: number,
): Promise<SavePredictionResult> {
  if (!Number.isInteger(matchId)) {
    return { ok: false, error: "Invalid match id" };
  }
  if (!isValidGoal(homeGoals) || !isValidGoal(awayGoals)) {
    return { ok: false, error: `Goals must be 0–${MAX_GOALS}` };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You're not signed in" };

  // Defensive lock check — the DB trigger also enforces it, but we want
  // a friendly message instead of a Postgres error string.
  const [{ data: settings }, { data: match }] = await Promise.all([
    supabase.from("settings").select("lock_at").eq("id", 1).single(),
    supabase
      .from("matches")
      .select("predictions_locked")
      .eq("id", matchId)
      .single(),
  ]);
  if (
    settings?.lock_at &&
    Date.now() >= new Date(settings.lock_at).getTime()
  ) {
    return { ok: false, error: "Predictions are locked" };
  }
  if (match?.predictions_locked) {
    return { ok: false, error: "Predictions for this match are locked" };
  }

  const { error: upsertError } = await supabase.from("match_predictions").upsert(
    {
      user_id: user.id,
      match_id: matchId,
      home_goals: homeGoals,
      away_goals: awayGoals,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,match_id" },
  );
  if (upsertError) return { ok: false, error: upsertError.message };

  // First submission timestamp — set once, used for tie-break #3.
  await supabase
    .from("profiles")
    .update({ first_submitted_at: new Date().toISOString() })
    .eq("id", user.id)
    .is("first_submitted_at", null);

  return { ok: true };
}

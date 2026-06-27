"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type SavePredictionResult =
  | { ok: true }
  | { ok: false; error: string };

export type OtherPrediction = {
  userId: string;
  displayName: string;
  home: number;
  away: number;
  /** null when the match isn't finished — stored .points is 0 by default and would be misleading. */
  points: number | null;
};

export type GetMatchPredictionsResult =
  | { ok: true; predictions: OtherPrediction[]; matchFinished: boolean }
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
  // Global lock_at is the GROUP-stage deadline only (match_no <= 72).
  // Knockout matches (match_no > 72) are gated only by their per-match flag.
  const [{ data: settings }, { data: match }] = await Promise.all([
    supabase.from("settings").select("lock_at").eq("id", 1).single(),
    supabase
      .from("matches")
      .select("match_no, predictions_locked")
      .eq("id", matchId)
      .single(),
  ]);
  const isGroupStage = (match?.match_no ?? 0) <= 72;
  if (
    isGroupStage &&
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

/**
 * Returns every user's prediction for a single match — but only once the match
 * is locked (either via the per-match flag or the global lock_at deadline).
 *
 * The new RLS policy opens cross-user SELECT after the global deadline, but
 * per-match locks aren't reflected there yet. We do the gate here and read via
 * the admin client so both lock kinds are covered uniformly.
 */
export async function getMatchPredictions(
  matchId: number,
): Promise<GetMatchPredictionsResult> {
  if (!Number.isInteger(matchId)) {
    return { ok: false, error: "Invalid match id" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You're not signed in" };

  const [settingsRes, matchRes] = await Promise.all([
    supabase.from("settings").select("lock_at").eq("id", 1).single(),
    supabase
      .from("matches")
      .select("predictions_locked, status")
      .eq("id", matchId)
      .single(),
  ]);
  if (matchRes.error || !matchRes.data) {
    return { ok: false, error: "Match not found" };
  }

  const lockAt = settingsRes.data?.lock_at ?? null;
  const globalLocked = lockAt
    ? Date.now() >= new Date(lockAt).getTime()
    : false;
  const matchLocked = matchRes.data.predictions_locked;
  if (!globalLocked && !matchLocked) {
    return {
      ok: false,
      error: "Predictions for this match aren't visible yet",
    };
  }

  const admin = createAdminClient();
  const { data: rows, error: predErr } = await admin
    .from("match_predictions")
    .select("user_id, home_goals, away_goals, points")
    .eq("match_id", matchId);
  if (predErr) return { ok: false, error: predErr.message };

  const matchFinished = matchRes.data.status === "finished";
  if (!rows || rows.length === 0) {
    return { ok: true, predictions: [], matchFinished };
  }

  const { data: profiles, error: profErr } = await admin
    .from("profiles")
    .select("id, display_name")
    .in(
      "id",
      rows.map((r) => r.user_id),
    );
  if (profErr) return { ok: false, error: profErr.message };

  const nameById = new Map(
    (profiles ?? []).map((p) => [p.id, p.display_name]),
  );

  const predictions: OtherPrediction[] = rows.map((r) => ({
    userId: r.user_id,
    displayName: nameById.get(r.user_id) ?? "Unknown",
    home: r.home_goals,
    away: r.away_goals,
    points: matchFinished ? r.points : null,
  }));
  predictions.sort((a, b) => {
    const pa = a.points ?? -1;
    const pb = b.points ?? -1;
    if (pa !== pb) return pb - pa;
    return a.displayName.localeCompare(b.displayName);
  });

  return { ok: true, predictions, matchFinished };
}

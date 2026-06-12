/**
 * Recomputes every prediction's stored .points and refreshes the cached
 * actual_group_standings from current match results. Called after admins
 * save or clear a match result.
 *
 * Implementation notes:
 * - Uses the service-role client so it can touch every user's prediction rows.
 *   The "own only" RLS policy on the prediction tables would otherwise reject
 *   cross-user writes.
 * - Scoring rules come from the pure functions in score.ts / standings.ts —
 *   single source of truth.
 * - Not transactional. We sequence the writes so prediction points and the
 *   standings table reach consistent values, but a crash mid-way leaves the
 *   cache inconsistent. The fix is "re-save the match result" — recompute is
 *   idempotent on every input.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import {
  deriveActualStandings,
  scoreOneMatchPrediction,
  type ScoringMatch,
} from "./leaderboard";

export type RecomputeResult = { ok: true } | { ok: false; error: string };

export async function recomputeScores(): Promise<RecomputeResult> {
  const supabase = createAdminClient();

  const [matchesRes, matchPredsRes, groupPredsRes] = await Promise.all([
    supabase
      .from("matches")
      .select(
        "id, group_code, home_team_id, away_team_id, home_goals, away_goals, status",
      ),
    supabase
      .from("match_predictions")
      .select("id, user_id, match_id, home_goals, away_goals"),
    supabase
      .from("group_table_predictions")
      .select("id, user_id, group_code, team_id, predicted_rank"),
  ]);

  if (matchesRes.error) return { ok: false, error: matchesRes.error.message };
  if (matchPredsRes.error)
    return { ok: false, error: matchPredsRes.error.message };
  if (groupPredsRes.error)
    return { ok: false, error: groupPredsRes.error.message };

  const matches: ScoringMatch[] = (matchesRes.data ?? []).map((m) => ({
    id: m.id,
    group_code: m.group_code,
    home_team_id: m.home_team_id,
    away_team_id: m.away_team_id,
    home_goals: m.home_goals,
    away_goals: m.away_goals,
    status: m.status === "finished" ? "finished" : "scheduled",
  }));
  const matchById = new Map(matches.map((m) => [m.id, m] as const));
  const actualStandings = deriveActualStandings(matches);

  // Match prediction updates. UPSERT requires every non-null column, so we
  // ship the existing values too — they're untouched but PostgREST needs them
  // present to satisfy the row constraints.
  const matchPredUpdates = (matchPredsRes.data ?? []).map((p) => {
    const m = matchById.get(p.match_id);
    const points =
      scoreOneMatchPrediction(
        { home_goals: p.home_goals, away_goals: p.away_goals },
        m ?? { status: "scheduled", home_goals: null, away_goals: null },
      ) ?? 0;
    return {
      id: p.id,
      user_id: p.user_id,
      match_id: p.match_id,
      home_goals: p.home_goals,
      away_goals: p.away_goals,
      points,
    };
  });

  // Group prediction updates. 5 if the team's actual final rank matches
  // the predicted rank, otherwise 0. Incomplete groups stay at 0.
  const groupPredUpdates = (groupPredsRes.data ?? []).map((p) => {
    const actualForGroup = actualStandings.get(p.group_code);
    const actualRank = actualForGroup?.get(p.team_id);
    const points = actualRank === p.predicted_rank ? 5 : 0;
    return {
      id: p.id,
      user_id: p.user_id,
      group_code: p.group_code,
      team_id: p.team_id,
      predicted_rank: p.predicted_rank,
      points,
    };
  });

  // Flatten actualStandings → rows for the actual_group_standings table.
  const standingsRows: {
    group_code: string;
    team_id: number;
    final_rank: number;
  }[] = [];
  for (const [groupCode, rankByTeam] of actualStandings) {
    for (const [teamId, rank] of rankByTeam) {
      standingsRows.push({
        group_code: groupCode,
        team_id: teamId,
        final_rank: rank,
      });
    }
  }

  // Write back: prediction caches in parallel, then standings (delete-all +
  // insert because of the unique(group_code, final_rank) constraint — two
  // teams can swap ranks between runs, which UPSERT can't express).
  const writes = await Promise.all([
    matchPredUpdates.length > 0
      ? supabase
          .from("match_predictions")
          .upsert(matchPredUpdates, { onConflict: "id" })
      : Promise.resolve({ error: null }),
    groupPredUpdates.length > 0
      ? supabase
          .from("group_table_predictions")
          .upsert(groupPredUpdates, { onConflict: "id" })
      : Promise.resolve({ error: null }),
    supabase.from("actual_group_standings").delete().gte("final_rank", 1),
  ]);
  for (const w of writes) {
    if (w.error) return { ok: false, error: w.error.message };
  }

  if (standingsRows.length > 0) {
    const { error } = await supabase
      .from("actual_group_standings")
      .insert(standingsRows);
    if (error) return { ok: false, error: error.message };
  }

  return { ok: true };
}

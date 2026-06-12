/**
 * Read-side leaderboard logic + shared primitives used by the recompute writer
 * (./recompute.ts). The leaderboard reads stored .points off each prediction —
 * the recompute keeps those values in sync — so this file does the SUM and
 * the rank ordering, not the scoring rules themselves.
 *
 * Scoring rules live in ./score.ts and ./standings.ts.
 */

import { scoreMatch } from "./score";
import { computeGroupStandings, type FinishedMatch } from "./standings";

export type ScoringMatch = {
  id: number;
  group_code: string;
  home_team_id: number;
  away_team_id: number;
  home_goals: number | null;
  away_goals: number | null;
  status: "scheduled" | "finished";
};

export type ScoredMatchPrediction = {
  user_id: string;
  points: number;
};

export type ScoredGroupPrediction = {
  user_id: string;
  points: number;
};

export type LeaderboardProfile = {
  id: string;
  display_name: string;
  first_submitted_at: string | null;
};

export type LeaderboardRow = {
  user_id: string;
  display_name: string;
  first_submitted_at: string | null;
  match_points: number;
  group_points: number;
  total_points: number;
  exact_hits: number;
  rank: number;
};

/**
 * Sums stored .points by user, counts exact hits (match preds worth 5), and
 * ranks. Tie-break: total desc → exact hits desc → first_submitted_at asc nulls last.
 */
export function rankLeaderboard(args: {
  profiles: ReadonlyArray<LeaderboardProfile>;
  matchPredictions: ReadonlyArray<ScoredMatchPrediction>;
  groupPredictions: ReadonlyArray<ScoredGroupPrediction>;
}): LeaderboardRow[] {
  const { profiles, matchPredictions, groupPredictions } = args;

  type Tally = { match: number; group: number; exact: number };
  const tally = new Map<string, Tally>();
  const tallyFor = (uid: string): Tally => {
    let t = tally.get(uid);
    if (!t) {
      t = { match: 0, group: 0, exact: 0 };
      tally.set(uid, t);
    }
    return t;
  };

  for (const p of matchPredictions) {
    const t = tallyFor(p.user_id);
    t.match += p.points;
    if (p.points === 5) t.exact += 1;
  }
  for (const p of groupPredictions) {
    tallyFor(p.user_id).group += p.points;
  }

  const rows: LeaderboardRow[] = profiles.map((p) => {
    const t = tally.get(p.id) ?? { match: 0, group: 0, exact: 0 };
    return {
      user_id: p.id,
      display_name: p.display_name,
      first_submitted_at: p.first_submitted_at,
      match_points: t.match,
      group_points: t.group,
      total_points: t.match + t.group,
      exact_hits: t.exact,
      rank: 0,
    };
  });

  rows.sort((a, b) => {
    if (a.total_points !== b.total_points) return b.total_points - a.total_points;
    if (a.exact_hits !== b.exact_hits) return b.exact_hits - a.exact_hits;
    if (a.first_submitted_at === b.first_submitted_at) return 0;
    if (a.first_submitted_at == null) return 1;
    if (b.first_submitted_at == null) return -1;
    return a.first_submitted_at < b.first_submitted_at ? -1 : 1;
  });
  rows.forEach((row, idx) => {
    row.rank = idx + 1;
  });
  return rows;
}

// --- Shared primitives consumed by recompute.ts -----------------------------

/**
 * groupCode → teamId → finalRank (1..4). Only groups whose 6 matches have all
 * finished appear in the map.
 */
export type ActualStandings = Map<string, Map<number, number>>;

export function deriveActualStandings(
  matches: ReadonlyArray<ScoringMatch>,
): ActualStandings {
  const byGroup = new Map<string, FinishedMatch[]>();
  for (const m of matches) {
    if (m.status !== "finished" || m.home_goals == null || m.away_goals == null) {
      continue;
    }
    const list = byGroup.get(m.group_code) ?? [];
    list.push({
      homeTeamId: m.home_team_id,
      awayTeamId: m.away_team_id,
      homeGoals: m.home_goals,
      awayGoals: m.away_goals,
    });
    byGroup.set(m.group_code, list);
  }

  const result: ActualStandings = new Map();
  for (const [groupCode, list] of byGroup) {
    const standings = computeGroupStandings(list);
    if (!standings) continue;
    const rankByTeam = new Map<number, number>();
    for (const row of standings) rankByTeam.set(row.teamId, row.rank);
    result.set(groupCode, rankByTeam);
  }
  return result;
}

/**
 * Points a match prediction is worth right now. Returns null if the match
 * isn't finished — the caller (recompute) should fall back to 0 in that case.
 */
export function scoreOneMatchPrediction(
  prediction: { home_goals: number; away_goals: number } | null | undefined,
  match: Pick<ScoringMatch, "status" | "home_goals" | "away_goals">,
): number | null {
  if (!prediction) return null;
  if (
    match.status !== "finished" ||
    match.home_goals == null ||
    match.away_goals == null
  ) {
    return null;
  }
  return scoreMatch(
    { home: prediction.home_goals, away: prediction.away_goals },
    { home: match.home_goals, away: match.away_goals },
  );
}

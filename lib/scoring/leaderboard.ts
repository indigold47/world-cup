/**
 * Read-side leaderboard logic + shared primitives used by the recompute writer
 * (./recompute.ts). The leaderboard reads stored .points off each prediction —
 * the recompute keeps those values in sync — so this file does the SUM and
 * the rank ordering, not the scoring rules themselves.
 *
 * Scoring rules live in ./score.ts and ./standings.ts.
 */

import { scoreMatch, scoreKnockoutBonus } from "./score";
import { computeGroupStandings, type FinishedMatch } from "./standings";

export type ScoringMatch = {
  id: number;
  // Null on knockout matches — they don't belong to a group. Standings
  // derivation skips them so they don't pollute group buckets.
  group_code: string | null;
  // Null on knockout slots whose opponents aren't decided yet.
  home_team_id: number | null;
  away_team_id: number | null;
  home_goals: number | null;
  away_goals: number | null;
  // Shootout result. Only meaningful on knockout rows where 90-min drew.
  home_pens: number | null;
  away_pens: number | null;
  // Drives the knockout bonus path. match_no <= 72 → group stage, scoring
  // ignores pens.
  match_no: number;
  status: "scheduled" | "finished";
};

export type ScoredMatchPrediction = {
  user_id: string;
  match_id: number;
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

export type LeaderboardStage = "all" | "group" | "knockout";

export type LeaderboardRow = {
  user_id: string;
  display_name: string;
  first_submitted_at: string | null;
  // Match points split by stage; group_table points only contribute to the
  // group view. `stage_points` is the per-stage total used for ranking.
  group_match_points: number;
  knockout_match_points: number;
  group_table_points: number;
  stage_points: number;
  exact_hits: number;
  rank: number;
};

/**
 * Sums stored .points by user, counts exact hits (match preds worth 5), and
 * ranks within a single stage view. Tie-break: stage_points desc → exact hits
 * desc → first_submitted_at asc nulls last.
 *
 * `stage` controls what counts toward `stage_points` and `exact_hits`:
 *   - 'all':      both group + knockout match points + group-table points
 *   - 'group':    group-stage match points + group-table points
 *   - 'knockout': knockout match points only
 *
 * `matchStageById` maps a match_id to either 'group' or 'knockout'. Predictions
 * whose match isn't in the map are treated as group (defensive default for the
 * pre-migration shape).
 */
export function rankLeaderboard(args: {
  profiles: ReadonlyArray<LeaderboardProfile>;
  matchPredictions: ReadonlyArray<ScoredMatchPrediction>;
  groupPredictions: ReadonlyArray<ScoredGroupPrediction>;
  matchStageById: ReadonlyMap<number, "group" | "knockout">;
  stage?: LeaderboardStage;
}): LeaderboardRow[] {
  const {
    profiles,
    matchPredictions,
    groupPredictions,
    matchStageById,
    stage = "all",
  } = args;

  type Tally = {
    group_match: number;
    knockout_match: number;
    group_table: number;
    exact_group: number;
    exact_knockout: number;
  };
  const tally = new Map<string, Tally>();
  const tallyFor = (uid: string): Tally => {
    let t = tally.get(uid);
    if (!t) {
      t = {
        group_match: 0,
        knockout_match: 0,
        group_table: 0,
        exact_group: 0,
        exact_knockout: 0,
      };
      tally.set(uid, t);
    }
    return t;
  };

  for (const p of matchPredictions) {
    const t = tallyFor(p.user_id);
    const matchStage = matchStageById.get(p.match_id) ?? "group";
    if (matchStage === "knockout") {
      t.knockout_match += p.points;
      if (p.points === 5) t.exact_knockout += 1;
    } else {
      t.group_match += p.points;
      if (p.points === 5) t.exact_group += 1;
    }
  }
  for (const p of groupPredictions) {
    tallyFor(p.user_id).group_table += p.points;
  }

  const rows: LeaderboardRow[] = profiles.map((p) => {
    const t = tally.get(p.id) ?? {
      group_match: 0,
      knockout_match: 0,
      group_table: 0,
      exact_group: 0,
      exact_knockout: 0,
    };
    const stagePoints =
      stage === "group"
        ? t.group_match + t.group_table
        : stage === "knockout"
          ? t.knockout_match
          : t.group_match + t.knockout_match + t.group_table;
    const exactHits =
      stage === "knockout"
        ? t.exact_knockout
        : stage === "group"
          ? t.exact_group
          : t.exact_group + t.exact_knockout;
    return {
      user_id: p.id,
      display_name: p.display_name,
      first_submitted_at: p.first_submitted_at,
      group_match_points: t.group_match,
      knockout_match_points: t.knockout_match,
      group_table_points: t.group_table,
      stage_points: stagePoints,
      exact_hits: exactHits,
      rank: 0,
    };
  });

  rows.sort((a, b) => {
    if (a.stage_points !== b.stage_points) return b.stage_points - a.stage_points;
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
    // Knockout matches have null group_code — they're not part of any group
    // table, so skip them outright. Same for any malformed group row.
    if (
      m.status !== "finished" ||
      m.home_goals == null ||
      m.away_goals == null ||
      m.group_code == null ||
      m.home_team_id == null ||
      m.away_team_id == null
    ) {
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
 *
 * For knockout matches (match_no > 72) we add scoreKnockoutBonus on top, so
 * a correct shootout-winner pick is worth +2 above the base 90-min score.
 */
export function scoreOneMatchPrediction(
  prediction:
    | {
        home_goals: number;
        away_goals: number;
        home_pens?: number | null;
        away_pens?: number | null;
      }
    | null
    | undefined,
  match: Pick<
    ScoringMatch,
    "status" | "home_goals" | "away_goals" | "home_pens" | "away_pens" | "match_no"
  >,
): number | null {
  if (!prediction) return null;
  if (
    match.status !== "finished" ||
    match.home_goals == null ||
    match.away_goals == null
  ) {
    return null;
  }
  const base = scoreMatch(
    { home: prediction.home_goals, away: prediction.away_goals },
    { home: match.home_goals, away: match.away_goals },
  );
  if (match.match_no <= 72) return base;
  const bonus = scoreKnockoutBonus(
    {
      home: prediction.home_goals,
      away: prediction.away_goals,
      homePens: prediction.home_pens ?? null,
      awayPens: prediction.away_pens ?? null,
    },
    {
      home: match.home_goals,
      away: match.away_goals,
      homePens: match.home_pens,
      awayPens: match.away_pens,
    },
  );
  return base + bonus;
}

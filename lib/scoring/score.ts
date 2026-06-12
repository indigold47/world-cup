/**
 * Voice123 World Cup — single source of truth for scoring math.
 *
 * Pure functions only. No DB, no time, no side effects. Consumed by
 * lib/scoring/leaderboard.ts at request time — scoring no longer happens
 * in SQL.
 *
 * Rules (from _docs/claude.md §5):
 *
 *   Match prediction:
 *     - Exact score (both home and away match)           => 5
 *     - Else, correct outcome (home/draw/away match)     => 2
 *     - Else                                             => 0
 *     Exact and outcome are NOT additive — exact is a flat 5.
 *
 *   Group-table prediction:
 *     - 5 points for each team placed at its correct final rank (1..4).
 */

export type Score = { home: number; away: number };

export type Outcome = "H" | "D" | "A";

export function outcome(home: number, away: number): Outcome {
  if (home > away) return "H";
  if (away > home) return "A";
  return "D";
}

export function scoreMatch(
  predicted: Score | null | undefined,
  actual: Score | null | undefined,
): number {
  if (!predicted || !actual) return 0;
  if (
    predicted.home === actual.home &&
    predicted.away === actual.away
  ) {
    return 5;
  }
  if (
    outcome(predicted.home, predicted.away) ===
    outcome(actual.home, actual.away)
  ) {
    return 2;
  }
  return 0;
}

export type RankedTeam = { teamId: number; rank: number };

export function scoreGroupTable(
  predicted: ReadonlyArray<RankedTeam>,
  actual: ReadonlyArray<RankedTeam>,
): number {
  const actualByTeam = new Map<number, number>();
  for (const t of actual) actualByTeam.set(t.teamId, t.rank);

  let points = 0;
  for (const p of predicted) {
    if (actualByTeam.get(p.teamId) === p.rank) points += 5;
  }
  return points;
}

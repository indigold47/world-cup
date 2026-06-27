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

/**
 * Knockout-only bonus on top of scoreMatch: +2 if the user predicted a draw,
 * the match actually drew at 90 min and went to pens, AND the user picked the
 * correct shootout winner. Pens *exact* score is intentionally not rewarded —
 * shootouts are coin-flippy, so a 6-5 vs 5-4 distinction is mostly luck.
 *
 * Returns the bonus to ADD to scoreMatch — never the total. 0 when any
 * precondition fails (so callers can blindly add).
 */
export function scoreKnockoutBonus(
  predicted: (Score & { homePens?: number | null; awayPens?: number | null }) | null | undefined,
  actual: (Score & { homePens?: number | null; awayPens?: number | null }) | null | undefined,
): number {
  if (!predicted || !actual) return 0;
  if (predicted.home !== predicted.away) return 0;
  if (actual.home !== actual.away) return 0;
  if (
    predicted.homePens == null ||
    predicted.awayPens == null ||
    actual.homePens == null ||
    actual.awayPens == null
  ) {
    return 0;
  }
  const predWinner = predicted.homePens > predicted.awayPens ? "H" : "A";
  const actWinner = actual.homePens > actual.awayPens ? "H" : "A";
  return predWinner === actWinner ? 2 : 0;
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

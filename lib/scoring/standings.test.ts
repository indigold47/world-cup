import { describe, it, expect } from "vitest";
import { computeGroupStandings } from "./standings";

describe("computeGroupStandings", () => {
  it("returns null when no matches finished", () => {
    expect(computeGroupStandings([])).toBeNull();
  });

  it("returns null when only some matches finished", () => {
    expect(
      computeGroupStandings([
        { homeTeamId: 1, awayTeamId: 2, homeGoals: 2, awayGoals: 1 },
      ]),
    ).toBeNull();
  });

  it("ranks 4 teams by points (clean linear order)", () => {
    // 1 wins all 3 → 9, 2 wins 2 → 6, 3 wins 1 → 3, 4 loses all → 0
    const standings = computeGroupStandings([
      { homeTeamId: 1, awayTeamId: 2, homeGoals: 2, awayGoals: 0 },
      { homeTeamId: 1, awayTeamId: 3, homeGoals: 2, awayGoals: 0 },
      { homeTeamId: 1, awayTeamId: 4, homeGoals: 2, awayGoals: 0 },
      { homeTeamId: 2, awayTeamId: 3, homeGoals: 1, awayGoals: 0 },
      { homeTeamId: 2, awayTeamId: 4, homeGoals: 1, awayGoals: 0 },
      { homeTeamId: 3, awayTeamId: 4, homeGoals: 1, awayGoals: 0 },
    ]);
    expect(standings).toEqual([
      { teamId: 1, rank: 1 },
      { teamId: 2, rank: 2 },
      { teamId: 3, rank: 3 },
      { teamId: 4, rank: 4 },
    ]);
  });

  it("breaks tie on goal difference", () => {
    // Teams 1, 2, 3, 4. 4 wins all (9 pts). 1, 2 tied on points; 1 has better GD.
    // 1: L 1-2, W 3-0, W 3-0  → 6 pts, GF 7, GA 2, GD +5
    // 2: W 2-1, W 1-0, W 1-0  → 9 pts, GF 4, GA 1, GD +3
    // We need 1 and 2 to tie on points. Let's reshape.
    //
    // Target: team A (id 1) and team B (id 2) both have 6 pts. Team A has better GD.
    //   A: W vs C 3-0, W vs D 3-0, L vs B 0-1 → 6 pts, GF 6, GA 1, GD +5
    //   B: W vs A 1-0, W vs C 1-0, L vs D 0-1 → 6 pts, GF 2, GA 1, GD +1
    //   C: L 0-3 to A, L 0-1 to B, W vs D 1-0 → 3 pts, GF 1, GA 4, GD -3
    //   D: L 0-3 to A, W vs B 1-0, L 0-1 to C → 3 pts, GF 1, GA 4, GD -3
    // Expected rank: A (1), B (2), then C and D tied on points and GD,
    //   tiebreak GF (both 1) — falls into "intentionally undefined" territory.
    // Let's bump D's goals so it's not tied with C.
    //   D: L 0-3 to A, W vs B 1-0, W vs C 2-0 → 6 pts, GF 3, GA 3, GD 0
    // Hmm that breaks the test (D now has 6 pts).
    //
    // Simpler design: just three teams matter for the tiebreak. Make 4th
    // distinctly worst.
    //   A (1): W 3-0 vs C, W 3-0 vs D, L 0-1 vs B → 6 pts, GF 6, GA 1, GD +5
    //   B (2): W 1-0 vs A, D 0-0 vs C, W 2-0 vs D → 7 pts… nope, breaks tie.
    //
    // Let me try yet again with explicit math:
    //   Want A and B both 6 pts, A has GD +5, B has GD +1. Achieved above
    //   if we don't accidentally tie C and D too.
    //   Tie C and D on points (3 each), but make C's GD better than D's:
    //     C: W vs D 2-0 (3 pts), L 0-3 to A, L 0-1 to B → 3 pts, GF 2, GA 4, GD -2
    //     D: L 0-2 to C, L 0-3 to A, W 1-0 over B → 3 pts, GF 1, GA 5, GD -4
    //   Now ranks: A (6 pts, +5 GD), B (6 pts, +1 GD), C (3 pts, -2), D (3 pts, -4).
    //   Final order: A, B, C, D.
    const standings = computeGroupStandings([
      // A vs B: B wins 1-0
      { homeTeamId: 1, awayTeamId: 2, homeGoals: 0, awayGoals: 1 },
      // A vs C: A wins 3-0
      { homeTeamId: 1, awayTeamId: 3, homeGoals: 3, awayGoals: 0 },
      // A vs D: A wins 3-0
      { homeTeamId: 1, awayTeamId: 4, homeGoals: 3, awayGoals: 0 },
      // B vs C: B wins 1-0
      { homeTeamId: 2, awayTeamId: 3, homeGoals: 1, awayGoals: 0 },
      // B vs D: D wins 1-0
      { homeTeamId: 2, awayTeamId: 4, homeGoals: 0, awayGoals: 1 },
      // C vs D: C wins 2-0
      { homeTeamId: 3, awayTeamId: 4, homeGoals: 2, awayGoals: 0 },
    ]);
    expect(standings).toEqual([
      { teamId: 1, rank: 1 },
      { teamId: 2, rank: 2 },
      { teamId: 3, rank: 3 },
      { teamId: 4, rank: 4 },
    ]);
  });

  it("breaks tie on goals scored when points and GD equal", () => {
    // Teams 1 and 2 both 4 pts, both GD +1. Team 1 GF 5, Team 2 GF 4.
    //   1: D 1-1 vs 2, W 3-1 vs 3, L 1-2 vs 4 → 4 pts, GF 5, GA 4, GD +1
    //   2: D 1-1 vs 1, W 3-1 vs 3, L 0-1 vs 4 → 4 pts, GF 4, GA 3, GD +1
    //   3: L 1-3 vs 1, L 1-3 vs 2, D 0-0 vs 4 → 1 pt,  GF 2, GA 6, GD -4
    //   4: W 2-1 vs 1, W 1-0 vs 2, D 0-0 vs 3 → 7 pts, GF 3, GA 1, GD +2
    // Order: 4 (7), 1 (4, GF 5), 2 (4, GF 4), 3 (1)
    const standings = computeGroupStandings([
      { homeTeamId: 1, awayTeamId: 2, homeGoals: 1, awayGoals: 1 },
      { homeTeamId: 1, awayTeamId: 3, homeGoals: 3, awayGoals: 1 },
      { homeTeamId: 1, awayTeamId: 4, homeGoals: 1, awayGoals: 2 },
      { homeTeamId: 2, awayTeamId: 3, homeGoals: 3, awayGoals: 1 },
      { homeTeamId: 2, awayTeamId: 4, homeGoals: 0, awayGoals: 1 },
      { homeTeamId: 3, awayTeamId: 4, homeGoals: 0, awayGoals: 0 },
    ]);
    expect(standings).toEqual([
      { teamId: 4, rank: 1 },
      { teamId: 1, rank: 2 },
      { teamId: 2, rank: 3 },
      { teamId: 3, rank: 4 },
    ]);
  });

  it("handles all-draws (every team on 3 points)", () => {
    // Every match a 1-1 draw → all 4 teams: 3 pts, GD 0, GF 3.
    // Tiebreak fully exhausted; row_number falls back to input order.
    // We don't assert specific rank ordering here — just that the result has
    // 4 unique ranks 1..4.
    const standings = computeGroupStandings([
      { homeTeamId: 1, awayTeamId: 2, homeGoals: 1, awayGoals: 1 },
      { homeTeamId: 1, awayTeamId: 3, homeGoals: 1, awayGoals: 1 },
      { homeTeamId: 1, awayTeamId: 4, homeGoals: 1, awayGoals: 1 },
      { homeTeamId: 2, awayTeamId: 3, homeGoals: 1, awayGoals: 1 },
      { homeTeamId: 2, awayTeamId: 4, homeGoals: 1, awayGoals: 1 },
      { homeTeamId: 3, awayTeamId: 4, homeGoals: 1, awayGoals: 1 },
    ]);
    expect(standings).not.toBeNull();
    expect(standings!.map((s) => s.rank).sort()).toEqual([1, 2, 3, 4]);
    expect(new Set(standings!.map((s) => s.teamId)).size).toBe(4);
  });
});

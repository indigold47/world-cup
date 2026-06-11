/**
 * Pure derivation of the actual final group standings from finished matches.
 *
 * The SQL function `public.recompute_scores()` encodes the same logic for the
 * live recompute path — keep this file and that function in sync.
 *
 * Tie-break: points (3 / 1 / 0) → goal difference (GF − GA) → goals scored (GF).
 * We intentionally stop at goals scored — no head-to-head, no fair-play, no
 * drawing of lots. Real-world ties this deep in 6-match groups are vanishingly
 * rare; if it happens, the admin can patch actual_group_standings directly in
 * the Supabase dashboard before the next recompute.
 */

export type FinishedMatch = {
  homeTeamId: number;
  awayTeamId: number;
  homeGoals: number;
  awayGoals: number;
};

export type StandingRow = {
  teamId: number;
  rank: number;
};

const TEAMS_PER_GROUP = 4;
const GAMES_PER_TEAM = 3;

/**
 * Returns 4 ranked rows if the group has played all 6 matches.
 * Returns null if the group is incomplete — caller should leave it unscored.
 */
export function computeGroupStandings(
  matches: ReadonlyArray<FinishedMatch>,
): StandingRow[] | null {
  type Stats = {
    teamId: number;
    games: number;
    points: number;
    gf: number;
    ga: number;
    gd: number;
  };

  const stats = new Map<number, Stats>();
  const init = (teamId: number) => {
    if (!stats.has(teamId)) {
      stats.set(teamId, {
        teamId,
        games: 0,
        points: 0,
        gf: 0,
        ga: 0,
        gd: 0,
      });
    }
  };

  for (const m of matches) {
    init(m.homeTeamId);
    init(m.awayTeamId);
    const home = stats.get(m.homeTeamId)!;
    const away = stats.get(m.awayTeamId)!;
    home.games++;
    away.games++;
    home.gf += m.homeGoals;
    home.ga += m.awayGoals;
    away.gf += m.awayGoals;
    away.ga += m.homeGoals;
    if (m.homeGoals > m.awayGoals) {
      home.points += 3;
    } else if (m.awayGoals > m.homeGoals) {
      away.points += 3;
    } else {
      home.points += 1;
      away.points += 1;
    }
  }

  if (stats.size !== TEAMS_PER_GROUP) return null;
  for (const s of stats.values()) {
    if (s.games !== GAMES_PER_TEAM) return null;
    s.gd = s.gf - s.ga;
  }

  const sorted = [...stats.values()].sort((a, b) => {
    if (a.points !== b.points) return b.points - a.points;
    if (a.gd !== b.gd) return b.gd - a.gd;
    return b.gf - a.gf;
  });

  return sorted.map((s, idx) => ({ teamId: s.teamId, rank: idx + 1 }));
}

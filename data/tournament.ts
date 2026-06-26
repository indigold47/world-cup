// Tournament metadata that lives alongside (not duplicating) the DB seed.
//
// The DB migration is the source of truth for groups, fixtures, and dates.
// This file owns presentational extras the DB doesn't need to know about —
// today that's flag emojis. Keep team names byte-for-byte identical to the
// `teams.name` column in the migration.

export const TEAM_FLAGS: Record<string, string> = {
  Mexico: "🇲🇽",
  "South Africa": "🇿🇦",
  "South Korea": "🇰🇷",
  "Czech Republic": "🇨🇿",
  Canada: "🇨🇦",
  "Bosnia and Herzegovina": "🇧🇦",
  Qatar: "🇶🇦",
  Switzerland: "🇨🇭",
  Brazil: "🇧🇷",
  Morocco: "🇲🇦",
  Haiti: "🇭🇹",
  Scotland: "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
  USA: "🇺🇸",
  Paraguay: "🇵🇾",
  Australia: "🇦🇺",
  Turkey: "🇹🇷",
  Germany: "🇩🇪",
  "Curaçao": "🇨🇼",
  "Ivory Coast": "🇨🇮",
  Ecuador: "🇪🇨",
  Netherlands: "🇳🇱",
  Japan: "🇯🇵",
  Sweden: "🇸🇪",
  Tunisia: "🇹🇳",
  Belgium: "🇧🇪",
  Egypt: "🇪🇬",
  Iran: "🇮🇷",
  "New Zealand": "🇳🇿",
  Spain: "🇪🇸",
  "Cape Verde": "🇨🇻",
  "Saudi Arabia": "🇸🇦",
  Uruguay: "🇺🇾",
  France: "🇫🇷",
  Senegal: "🇸🇳",
  Iraq: "🇮🇶",
  Norway: "🇳🇴",
  Argentina: "🇦🇷",
  Algeria: "🇩🇿",
  Austria: "🇦🇹",
  Jordan: "🇯🇴",
  Portugal: "🇵🇹",
  "DR Congo": "🇨🇩",
  Uzbekistan: "🇺🇿",
  Colombia: "🇨🇴",
  England: "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
  Croatia: "🇭🇷",
  Ghana: "🇬🇭",
  Panama: "🇵🇦",
};

export const GROUP_CODES = [
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
  "I",
  "J",
  "K",
  "L",
] as const;

export type GroupCode = (typeof GROUP_CODES)[number];

export const KNOCKOUT_ROUNDS = ["R32", "R16", "QF", "SF", "F"] as const;
export type KnockoutRound = (typeof KNOCKOUT_ROUNDS)[number];
export type Round = "GROUP" | KnockoutRound;

// match_no is the round discriminator — no schema column needed.
// 1..72   group stage (72 matches)
// 73..88  Round of 32 (16)
// 89..96  Round of 16 (8)
// 97..100 Quarter-finals (4)
// 101..102 Semi-finals (2)
// 103     Final (1)
export function roundFromMatchNo(matchNo: number): Round {
  if (matchNo <= 72) return "GROUP";
  if (matchNo <= 88) return "R32";
  if (matchNo <= 96) return "R16";
  if (matchNo <= 100) return "QF";
  if (matchNo <= 102) return "SF";
  return "F";
}

export const ROUND_LABELS: Record<KnockoutRound, string> = {
  R32: "Round of 32",
  R16: "Round of 16",
  QF: "Quarter-finals",
  SF: "Semi-finals",
  F: "Final",
};

export const ROUND_SHORT: Record<KnockoutRound, string> = {
  R32: "R32",
  R16: "R16",
  QF: "QF",
  SF: "SF",
  F: "Final",
};

export function flagFor(teamName: string | null | undefined): string {
  if (!teamName) return "🏳️";
  return TEAM_FLAGS[teamName] ?? "🏳️";
}

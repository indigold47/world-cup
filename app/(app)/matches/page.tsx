import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { MatchPredictor, type MatchData, type MatchPrediction } from "./match-predictor";

export const metadata = { title: "Matches · Office World Cup Pool" };

export default async function MatchesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const [teamsRes, matchesRes, predictionsRes, settingsRes] = await Promise.all([
    supabase.from("teams").select("id, name, group_code"),
    supabase
      .from("matches")
      .select("id, match_no, group_code, match_date, home_team_id, away_team_id")
      .order("match_date")
      .order("match_no"),
    supabase
      .from("match_predictions")
      .select("match_id, home_goals, away_goals")
      .eq("user_id", user.id),
    supabase.from("settings").select("lock_at").eq("id", 1).single(),
  ]);

  const teamsById = new Map<number, { name: string; group_code: string }>(
    (teamsRes.data ?? []).map((t) => [
      t.id,
      { name: t.name, group_code: t.group_code },
    ]),
  );

  const matches: MatchData[] = (matchesRes.data ?? []).map((m) => ({
    id: m.id,
    matchNo: m.match_no,
    groupCode: m.group_code,
    date: m.match_date,
    homeTeamName: teamsById.get(m.home_team_id)?.name ?? "—",
    awayTeamName: teamsById.get(m.away_team_id)?.name ?? "—",
  }));

  const predictions: Record<number, MatchPrediction> = {};
  for (const p of predictionsRes.data ?? []) {
    predictions[p.match_id] = { home: p.home_goals, away: p.away_goals };
  }

  const lockAt = settingsRes.data?.lock_at ?? null;
  const isLocked = lockAt ? Date.now() >= new Date(lockAt).getTime() : false;

  return (
    <main className="flex flex-col gap-6 py-6 sm:py-10">
      <PageHeader
        eyebrow="Group stage"
        title="Predict every match"
        subtitle="Tap a tab to jump between groups. Your picks save automatically."
      />
      <MatchPredictor
        matches={matches}
        initialPredictions={predictions}
        isLocked={isLocked}
        lockAt={lockAt}
      />
    </main>
  );
}

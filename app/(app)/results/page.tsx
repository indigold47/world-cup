import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { roundFromMatchNo } from "@/data/tournament";
import { LockEditor } from "./lock-editor";
import {
  MatchResultsEditor,
  type AdminMatchData,
  type TeamOption,
} from "./match-results-editor";

export const metadata = { title: "Results · Voice123 World Cup Pool" };

export default async function ResultsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") redirect("/");

  const [settingsRes, teamsRes, matchesRes] = await Promise.all([
    supabase.from("settings").select("lock_at").eq("id", 1).single(),
    supabase.from("teams").select("id, name, group_code").order("name"),
    // Round derived from match_no — no schema column required.
    supabase
      .from("matches")
      .select(
        "id, match_no, group_code, match_date, home_team_id, away_team_id, home_goals, away_goals, home_pens, away_pens, status, predictions_locked",
      )
      .order("match_no"),
  ]);

  const teamsById = new Map<number, string>(
    (teamsRes.data ?? []).map((t) => [t.id, t.name]),
  );

  const teamOptions: TeamOption[] = (teamsRes.data ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    groupCode: t.group_code,
  }));

  const matches: AdminMatchData[] = (matchesRes.data ?? []).map((m) => ({
    id: m.id,
    matchNo: m.match_no,
    round: roundFromMatchNo(m.match_no),
    groupCode: m.group_code,
    date: m.match_date,
    homeTeamId: m.home_team_id,
    awayTeamId: m.away_team_id,
    homeTeamName:
      m.home_team_id != null ? teamsById.get(m.home_team_id) ?? null : null,
    awayTeamName:
      m.away_team_id != null ? teamsById.get(m.away_team_id) ?? null : null,
    homeGoals: m.home_goals,
    awayGoals: m.away_goals,
    homePens: m.home_pens,
    awayPens: m.away_pens,
    status: m.status === "finished" ? "finished" : "scheduled",
    predictionsLocked: m.predictions_locked,
  }));

  return (
    <main className="flex flex-col gap-6 py-6 sm:py-10">
      <PageHeader
        eyebrow="Admin"
        title="Admin controls"
        subtitle="Set the deadline, fill knockout matchups, and enter actual scores as matches finish."
      />

      <LockEditor currentLockAt={settingsRes.data?.lock_at ?? null} />

      <MatchResultsEditor matches={matches} teamOptions={teamOptions} />
    </main>
  );
}

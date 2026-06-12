import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { LockEditor } from "./lock-editor";
import {
  MatchResultsEditor,
  type AdminMatchData,
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
    supabase.from("teams").select("id, name, group_code"),
    supabase
      .from("matches")
      .select(
        "id, match_no, group_code, match_date, home_team_id, away_team_id, home_goals, away_goals, status, predictions_locked",
      )
      .order("match_date")
      .order("match_no"),
  ]);

  const teamsById = new Map<number, string>(
    (teamsRes.data ?? []).map((t) => [t.id, t.name]),
  );

  const matches: AdminMatchData[] = (matchesRes.data ?? []).map((m) => ({
    id: m.id,
    matchNo: m.match_no,
    groupCode: m.group_code,
    date: m.match_date,
    homeTeamName: teamsById.get(m.home_team_id) ?? "—",
    awayTeamName: teamsById.get(m.away_team_id) ?? "—",
    homeGoals: m.home_goals,
    awayGoals: m.away_goals,
    status: m.status === "finished" ? "finished" : "scheduled",
    predictionsLocked: m.predictions_locked,
  }));

  return (
    <main className="flex flex-col gap-6 py-6 sm:py-10">
      <PageHeader
        eyebrow="Admin"
        title="Admin controls"
        subtitle="Set the prediction deadline and enter the actual scores as matches finish."
      />

      <LockEditor currentLockAt={settingsRes.data?.lock_at ?? null} />

      <MatchResultsEditor matches={matches} />
    </main>
  );
}

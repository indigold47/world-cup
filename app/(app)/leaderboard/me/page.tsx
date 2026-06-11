import Link from "next/link";
import { redirect } from "next/navigation";
import { Sparkles, Check, X } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { StatPill, ScoreBadge } from "@/components/stat-pill";
import { flagFor, GROUP_CODES, type GroupCode } from "@/data/tournament";
import { cn } from "@/lib/utils";

export const metadata = { title: "My scorecard · Voice123 World Cup Pool" };
export const dynamic = "force-dynamic";

// Postgres `date` arrives as "YYYY-MM-DD" → parsed as midnight UTC. Pin the
// formatter to UTC so the displayed weekday doesn't tick back a day in
// negative-UTC timezones.
const DATE_FMT = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

export default async function MyScorecardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const [
    teamsRes,
    matchesRes,
    matchPredictionsRes,
    groupPredictionsRes,
    standingsRes,
    leaderboardRes,
  ] = await Promise.all([
    supabase.from("teams").select("id, name, group_code"),
    supabase
      .from("matches")
      .select(
        "id, match_no, group_code, match_date, home_team_id, away_team_id, home_goals, away_goals, status",
      )
      .order("match_date")
      .order("match_no"),
    supabase
      .from("match_predictions")
      .select("match_id, home_goals, away_goals, points")
      .eq("user_id", user.id),
    supabase
      .from("group_table_predictions")
      .select("group_code, team_id, predicted_rank, points")
      .eq("user_id", user.id),
    supabase
      .from("actual_group_standings")
      .select("group_code, team_id, final_rank"),
    supabase.rpc("get_leaderboard"),
  ]);

  const teamsById = new Map<number, { name: string; group_code: string }>(
    (teamsRes.data ?? []).map((t) => [
      t.id,
      { name: t.name, group_code: t.group_code },
    ]),
  );

  // Match predictions keyed by match id
  type MatchPred = { home: number; away: number; points: number };
  const myMatchPred = new Map<number, MatchPred>();
  for (const p of matchPredictionsRes.data ?? []) {
    myMatchPred.set(p.match_id, {
      home: p.home_goals,
      away: p.away_goals,
      points: p.points,
    });
  }

  // Group user's match rows by group code, in match-date order
  type RowMatch = {
    matchId: number;
    matchNo: number;
    date: string;
    homeName: string;
    awayName: string;
    homeActual: number | null;
    awayActual: number | null;
    finished: boolean;
    predicted?: MatchPred;
  };
  const matchesByGroup = new Map<GroupCode, RowMatch[]>();
  for (const code of GROUP_CODES) matchesByGroup.set(code, []);
  for (const m of matchesRes.data ?? []) {
    const code = m.group_code as GroupCode;
    matchesByGroup.get(code)?.push({
      matchId: m.id,
      matchNo: m.match_no,
      date: m.match_date,
      homeName: teamsById.get(m.home_team_id)?.name ?? "—",
      awayName: teamsById.get(m.away_team_id)?.name ?? "—",
      homeActual: m.home_goals,
      awayActual: m.away_goals,
      finished: m.status === "finished",
      predicted: myMatchPred.get(m.id),
    });
  }

  // Group predictions / actual standings
  type GroupPred = {
    teamId: number;
    predictedRank: number;
    points: number;
  };
  const myGroupPred = new Map<string, GroupPred[]>();
  for (const p of groupPredictionsRes.data ?? []) {
    if (!myGroupPred.has(p.group_code)) myGroupPred.set(p.group_code, []);
    myGroupPred.get(p.group_code)!.push({
      teamId: p.team_id,
      predictedRank: p.predicted_rank,
      points: p.points,
    });
  }
  const actualStandings = new Map<string, Map<number, number>>(); // groupCode → teamId → rank
  for (const s of standingsRes.data ?? []) {
    if (!actualStandings.has(s.group_code))
      actualStandings.set(s.group_code, new Map());
    actualStandings.get(s.group_code)!.set(s.team_id, s.final_rank);
  }

  // Totals
  const matchTotal = (matchPredictionsRes.data ?? []).reduce(
    (n, p) => n + p.points,
    0,
  );
  const groupTotal = (groupPredictionsRes.data ?? []).reduce(
    (n, p) => n + p.points,
    0,
  );
  const exactHits = (matchPredictionsRes.data ?? []).filter(
    (p) => p.points === 5,
  ).length;
  const totalPoints = matchTotal + groupTotal;

  // My leaderboard rank
  const lbRows = (leaderboardRes.data ?? []) as Array<{
    user_id: string;
    rank: number;
    total_points: number;
  }>;
  const myLb = lbRows.find((r) => r.user_id === user.id);

  return (
    <main className="flex flex-col gap-6 py-6 sm:py-10">
      <PageHeader
        eyebrow="Your scorecard"
        title="Every prediction, every point."
        subtitle="Match-by-match and group-by-group, with the actuals alongside so you can see exactly where you scored."
        action={
          <Button
            render={<Link href="/leaderboard" />}
            nativeButton={false}
            variant="ghost"
            size="sm"
          >
            ← Back to leaderboard
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatPill
          label="Total points"
          value={totalPoints}
          hint={myLb ? `Rank ${myLb.rank}` : undefined}
          variant={totalPoints > 0 ? "success" : "default"}
        />
        <StatPill label="From matches" value={matchTotal} />
        <StatPill label="From groups" value={groupTotal} />
        <StatPill
          label="Exact scores"
          value={exactHits}
          variant={exactHits > 0 ? "success" : "default"}
        />
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">
          Match predictions
        </h2>
        {GROUP_CODES.map((code) => {
          const matches = matchesByGroup.get(code) ?? [];
          const subtotal = matches.reduce(
            (n, m) => n + (m.predicted?.points ?? 0),
            0,
          );
          return (
            <article
              key={code}
              className="rounded-lg border bg-card p-3 sm:p-4"
            >
              <header className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold">
                  <span className="text-muted-foreground">Group</span> {code}
                </h3>
                <span className="text-sm font-semibold tabular-nums">
                  +{subtotal}
                </span>
              </header>
              <ul className="space-y-2">
                {matches.map((m) => (
                  <MatchScorecardRow key={m.matchId} m={m} />
                ))}
              </ul>
            </article>
          );
        })}
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">
          Group-table predictions
        </h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {GROUP_CODES.map((code) => {
            const preds = (myGroupPred.get(code) ?? []).slice().sort(
              (a, b) => a.predictedRank - b.predictedRank,
            );
            const actual = actualStandings.get(code);
            const subtotal = preds.reduce((n, p) => n + p.points, 0);
            return (
              <article
                key={code}
                className="rounded-lg border bg-card p-3 sm:p-4"
              >
                <header className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-semibold">
                    <span className="text-muted-foreground">Group</span> {code}
                  </h3>
                  <span className="text-sm font-semibold tabular-nums">
                    +{subtotal}
                  </span>
                </header>
                {preds.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No prediction submitted.
                  </p>
                ) : (
                  <ol className="space-y-1">
                    {preds.map((p) => {
                      const team = teamsById.get(p.teamId);
                      const actualRank = actual?.get(p.teamId);
                      const correct = actualRank === p.predictedRank;
                      const hasActual = actualRank != null;
                      return (
                        <li
                          key={p.teamId}
                          className={cn(
                            "flex items-center gap-2 rounded-md border bg-background py-1.5 pl-2 pr-2",
                            correct && hasActual && "border-success/40 bg-success/5",
                          )}
                        >
                          <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-muted text-[10px] font-semibold tabular-nums">
                            {p.predictedRank}
                          </span>
                          <span aria-hidden className="text-base leading-none">
                            {team ? flagFor(team.name) : "🏳️"}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-xs font-medium">
                            {team?.name ?? "Unknown"}
                          </span>
                          {hasActual ? (
                            correct ? (
                              <span className="flex items-center gap-1 text-[10px] font-medium text-success">
                                <Check className="h-3 w-3" /> +5
                              </span>
                            ) : (
                              <span className="text-[10px] text-muted-foreground">
                                was {actualRank}
                              </span>
                            )
                          ) : (
                            <span className="text-[10px] text-muted-foreground">
                              —
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                )}
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}

function MatchScorecardRow({
  m,
}: {
  m: {
    matchId: number;
    matchNo: number;
    date: string;
    homeName: string;
    awayName: string;
    homeActual: number | null;
    awayActual: number | null;
    finished: boolean;
    predicted?: { home: number; away: number; points: number };
  };
}) {
  const dateLabel = DATE_FMT.format(new Date(m.date));
  const exact = m.predicted?.points === 5;
  const outcome = m.predicted && m.predicted.points === 2;

  return (
    <li
      className={cn(
        "rounded-md border bg-background p-2.5 sm:p-3 transition-colors",
        exact && "border-success/40 bg-success/5",
      )}
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {dateLabel} · #{m.matchNo}
        </span>
        {m.predicted ? (
          exact ? (
            <span className="flex items-center gap-1 text-[10px] font-semibold text-success">
              <Sparkles className="h-3 w-3" /> Exact · +5
            </span>
          ) : outcome ? (
            <span className="text-[10px] font-medium text-foreground">
              Outcome · +2
            </span>
          ) : m.finished ? (
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <X className="h-3 w-3" /> +0
            </span>
          ) : (
            <span className="text-[10px] text-muted-foreground">Pending</span>
          )
        ) : (
          <span className="text-[10px] text-muted-foreground">
            Not predicted
          </span>
        )}
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <span aria-hidden className="text-base leading-none">
            {flagFor(m.homeName)}
          </span>
          <span className="truncate text-xs font-medium">{m.homeName}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <ScoreBadge
            home={m.homeActual}
            away={m.awayActual}
            variant={m.finished ? "actual" : "default"}
          />
        </div>
        <div className="flex min-w-0 items-center justify-end gap-1.5">
          <span className="truncate text-right text-xs font-medium">
            {m.awayName}
          </span>
          <span aria-hidden className="text-base leading-none">
            {flagFor(m.awayName)}
          </span>
        </div>
      </div>
      {m.predicted && (
        <p className="mt-1.5 text-[10px] text-muted-foreground">
          You said{" "}
          <span className="font-semibold text-foreground tabular-nums">
            {m.predicted.home}–{m.predicted.away}
          </span>
        </p>
      )}
    </li>
  );
}

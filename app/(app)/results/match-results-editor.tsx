"use client";

import { useMemo } from "react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  GROUP_CODES,
  KNOCKOUT_ROUNDS,
  ROUND_SHORT,
  type GroupCode,
  type KnockoutRound,
} from "@/data/tournament";
import { MatchResultRow } from "./match-result-row";

export type TeamOption = {
  id: number;
  name: string;
  groupCode: string;
};

export type AdminMatchData = {
  id: number;
  matchNo: number;
  round: string;
  groupCode: string | null;
  date: string | null;
  homeTeamId: number | null;
  awayTeamId: number | null;
  homeTeamName: string | null;
  awayTeamName: string | null;
  homeGoals: number | null;
  awayGoals: number | null;
  status: "scheduled" | "finished";
  predictionsLocked: boolean;
};

const DATE_FMT = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

function formatDate(iso: string | null): string {
  if (!iso) return "Date TBD";
  return DATE_FMT.format(new Date(iso));
}

export function MatchResultsEditor({
  matches,
  teamOptions,
}: {
  matches: AdminMatchData[];
  teamOptions: TeamOption[];
}) {
  const groupMatches = useMemo(
    () => matches.filter((m) => m.round === "GROUP"),
    [matches],
  );
  const knockoutMatches = useMemo(
    () => matches.filter((m) => m.round !== "GROUP"),
    [matches],
  );

  const groupFinished = groupMatches.filter(
    (m) => m.status === "finished",
  ).length;
  const knockoutFinished = knockoutMatches.filter(
    (m) => m.status === "finished",
  ).length;

  return (
    <section className="space-y-4">
      <Tabs defaultValue="group" className="gap-3">
        <TabsList className="w-full">
          <TabsTrigger value="group" className="flex-1">
            Group stage
          </TabsTrigger>
          <TabsTrigger value="knockout" className="flex-1">
            Knockout
          </TabsTrigger>
        </TabsList>

        <TabsContent value="group" className="space-y-4">
          <StageProgress
            finished={groupFinished}
            total={groupMatches.length}
          />
          <GroupStageEditor matches={groupMatches} />
        </TabsContent>

        <TabsContent value="knockout" className="space-y-4">
          <StageProgress
            finished={knockoutFinished}
            total={knockoutMatches.length}
          />
          <KnockoutEditor matches={knockoutMatches} teamOptions={teamOptions} />
        </TabsContent>
      </Tabs>
    </section>
  );
}

function StageProgress({
  finished,
  total,
}: {
  finished: number;
  total: number;
}) {
  return (
    <div className="rounded-lg border bg-card p-4 sm:p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Results entered
          </p>
          <p className="text-2xl font-semibold tabular-nums">
            {finished} <span className="text-muted-foreground">/ {total}</span>
          </p>
        </div>
        <p className="text-sm text-muted-foreground">
          {total === 0
            ? "No matches yet."
            : finished === total
              ? "All matches finished."
              : `${total - finished} still scheduled`}
        </p>
      </div>
      <Progress
        value={total === 0 ? 0 : (finished / total) * 100}
        className="mt-3 h-2"
      />
    </div>
  );
}

function GroupStageEditor({ matches }: { matches: AdminMatchData[] }) {
  const matchesByGroup = useMemo(() => {
    const map = new Map<GroupCode, AdminMatchData[]>();
    for (const code of GROUP_CODES) map.set(code, []);
    for (const m of matches) {
      map.get(m.groupCode as GroupCode)?.push(m);
    }
    return map;
  }, [matches]);

  return (
    <Tabs defaultValue="A" className="gap-3">
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <TabsList className="inline-flex w-auto">
          {GROUP_CODES.map((code) => {
            const groupMatches = matchesByGroup.get(code) ?? [];
            const groupDone = groupMatches.filter(
              (m) => m.status === "finished",
            ).length;
            const complete = groupDone === groupMatches.length;
            return (
              <TabsTrigger key={code} value={code} className="gap-1.5">
                <span className="font-semibold">{code}</span>
                <span
                  className={`text-[10px] tabular-nums ${
                    complete ? "text-success" : "text-muted-foreground"
                  }`}
                >
                  {groupDone}/{groupMatches.length}
                </span>
              </TabsTrigger>
            );
          })}
        </TabsList>
      </div>

      {GROUP_CODES.map((code) => {
        const groupMatches = matchesByGroup.get(code) ?? [];
        return (
          <TabsContent key={code} value={code} className="space-y-3">
            {groupMatches.map((m) => (
              <MatchResultRow
                key={m.id}
                match={m}
                dateLabel={formatDate(m.date)}
              />
            ))}
          </TabsContent>
        );
      })}
    </Tabs>
  );
}

function KnockoutEditor({
  matches,
  teamOptions,
}: {
  matches: AdminMatchData[];
  teamOptions: TeamOption[];
}) {
  const matchesByRound = useMemo(() => {
    const map = new Map<KnockoutRound, AdminMatchData[]>();
    for (const r of KNOCKOUT_ROUNDS) map.set(r, []);
    for (const m of matches) {
      map.get(m.round as KnockoutRound)?.push(m);
    }
    return map;
  }, [matches]);

  const firstWithMatches =
    KNOCKOUT_ROUNDS.find((r) => (matchesByRound.get(r) ?? []).length > 0) ?? "R32";

  if (matches.length === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-card p-6 text-center text-sm text-muted-foreground">
        No knockout fixtures seeded yet.
      </div>
    );
  }

  return (
    <Tabs defaultValue={firstWithMatches} className="gap-3">
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <TabsList className="inline-flex w-auto">
          {KNOCKOUT_ROUNDS.map((r) => {
            const rounds = matchesByRound.get(r) ?? [];
            const doneHere = rounds.filter(
              (m) => m.status === "finished",
            ).length;
            const complete =
              rounds.length > 0 && doneHere === rounds.length;
            return (
              <TabsTrigger key={r} value={r} className="gap-1.5" disabled={rounds.length === 0}>
                <span className="font-semibold">{ROUND_SHORT[r]}</span>
                {rounds.length > 0 && (
                  <span
                    className={`text-[10px] tabular-nums ${
                      complete ? "text-success" : "text-muted-foreground"
                    }`}
                  >
                    {doneHere}/{rounds.length}
                  </span>
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>
      </div>

      {KNOCKOUT_ROUNDS.map((r) => {
        const rounds = matchesByRound.get(r) ?? [];
        return (
          <TabsContent key={r} value={r} className="space-y-3">
            {rounds.length === 0 ? (
              <div className="rounded-lg border border-dashed bg-card p-6 text-center text-sm text-muted-foreground">
                No fixtures yet for this round.
              </div>
            ) : (
              rounds.map((m) => (
                <MatchResultRow
                  key={m.id}
                  match={m}
                  dateLabel={formatDate(m.date)}
                  teamOptions={teamOptions}
                />
              ))
            )}
          </TabsContent>
        );
      })}
    </Tabs>
  );
}

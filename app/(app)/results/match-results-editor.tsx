"use client";

import { useMemo } from "react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { GROUP_CODES, type GroupCode } from "@/data/tournament";
import { MatchResultRow } from "./match-result-row";

export type AdminMatchData = {
  id: number;
  matchNo: number;
  groupCode: string;
  date: string;
  homeTeamName: string;
  awayTeamName: string;
  homeGoals: number | null;
  awayGoals: number | null;
  status: "scheduled" | "finished";
};

// match_date is a Postgres `date` (no time), arriving as "YYYY-MM-DD".
// new Date() treats that as midnight UTC, so renders ticked back a day in
// negative-UTC zones. Pin to UTC to keep the displayed day truthful.
const DATE_FMT = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

function formatDate(iso: string): string {
  return DATE_FMT.format(new Date(iso));
}

export function MatchResultsEditor({ matches }: { matches: AdminMatchData[] }) {
  const matchesByGroup = useMemo(() => {
    const map = new Map<GroupCode, AdminMatchData[]>();
    for (const code of GROUP_CODES) map.set(code, []);
    for (const m of matches) {
      map.get(m.groupCode as GroupCode)?.push(m);
    }
    return map;
  }, [matches]);

  const total = matches.length;
  const finished = matches.filter((m) => m.status === "finished").length;

  return (
    <section className="space-y-4">
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
            {finished === total
              ? "All matches finished."
              : `${total - finished} still scheduled`}
          </p>
        </div>
        <Progress
          value={total === 0 ? 0 : (finished / total) * 100}
          className="mt-3 h-2"
        />
      </div>

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
    </section>
  );
}

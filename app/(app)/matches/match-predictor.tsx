"use client";

import { useMemo, useState } from "react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { LockedBanner } from "@/components/locked-banner";
import { Countdown } from "@/components/countdown";
import { GROUP_CODES, type GroupCode } from "@/data/tournament";
import { MatchRow } from "./match-row";

export type MatchData = {
  id: number;
  matchNo: number;
  groupCode: string;
  date: string;
  homeTeamName: string;
  awayTeamName: string;
};

export type MatchPrediction = {
  home: number;
  away: number;
};

type Props = {
  matches: MatchData[];
  initialPredictions: Record<number, MatchPrediction>;
  isLocked: boolean;
  lockAt: string | null;
};

// Postgres `date` columns arrive as "YYYY-MM-DD". `new Date(...)` parses them
// as midnight UTC, which displays as the previous evening in negative-UTC
// timezones. Pin the formatter to UTC so the displayed day matches the seed.
const DATE_FMT = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

function formatDate(iso: string): string {
  return DATE_FMT.format(new Date(iso));
}

export function MatchPredictor({
  matches,
  initialPredictions,
  isLocked,
  lockAt,
}: Props) {
  // Tracks which match IDs have a complete prediction. Updated by MatchRow
  // via onPredictionStateChange so the progress badge stays live.
  const [predicted, setPredicted] = useState<Set<number>>(() => {
    const init = new Set<number>();
    for (const id of Object.keys(initialPredictions)) init.add(Number(id));
    return init;
  });

  const matchesByGroup = useMemo(() => {
    const map = new Map<GroupCode, MatchData[]>();
    for (const code of GROUP_CODES) map.set(code, []);
    for (const m of matches) {
      const list = map.get(m.groupCode as GroupCode);
      if (list) list.push(m);
    }
    return map;
  }, [matches]);

  const total = matches.length;
  const done = predicted.size;

  const handlePredictionStateChange = (matchId: number, complete: boolean) => {
    setPredicted((prev) => {
      const next = new Set(prev);
      if (complete) next.add(matchId);
      else next.delete(matchId);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card p-4 sm:p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Your progress
            </p>
            <p className="text-2xl font-semibold tabular-nums">
              {done} <span className="text-muted-foreground">/ {total}</span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">
              {done === total
                ? "All matches predicted."
                : `${total - done} to go`}
            </p>
            {!isLocked && lockAt && (
              <Countdown variant="compact" lockAt={lockAt} className="mt-1" />
            )}
          </div>
        </div>
        <Progress value={total === 0 ? 0 : (done / total) * 100} className="mt-3 h-2" />
      </div>

      {isLocked && lockAt && <LockedBanner lockedAt={new Date(lockAt)} />}

      <Tabs defaultValue="A" className="gap-3">
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <TabsList className="inline-flex w-auto">
            {GROUP_CODES.map((code) => {
              const groupMatches = matchesByGroup.get(code) ?? [];
              const groupDone = groupMatches.filter((m) =>
                predicted.has(m.id),
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
                <MatchRow
                  key={m.id}
                  match={m}
                  dateLabel={formatDate(m.date)}
                  initial={initialPredictions[m.id]}
                  locked={isLocked}
                  onPredictionStateChange={handlePredictionStateChange}
                />
              ))}
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}

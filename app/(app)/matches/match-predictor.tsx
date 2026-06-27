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
import {
  GROUP_CODES,
  KNOCKOUT_ROUNDS,
  ROUND_SHORT,
  type GroupCode,
  type KnockoutRound,
} from "@/data/tournament";
import { MatchRow } from "./match-row";

export type MatchData = {
  id: number;
  matchNo: number;
  /** 'GROUP' | 'R32' | 'R16' | 'QF' | 'SF' | 'F' */
  round: string;
  /** Null for knockout rows. */
  groupCode: string | null;
  /** Null for knockout slots whose date is still TBD. */
  date: string | null;
  /** Null when the bracket slot still says TBD. */
  homeTeamName: string | null;
  awayTeamName: string | null;
  predictionsLocked: boolean;
};

export type MatchPrediction = {
  home: number;
  away: number;
  homePens?: number | null;
  awayPens?: number | null;
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

function formatDate(iso: string | null): string {
  if (!iso) return "Date TBD";
  return DATE_FMT.format(new Date(iso));
}

// A knockout match becomes predictable only when both opponents AND the
// kickoff date are set. Half-filled rows would just confuse players, so the
// player view hides them entirely until admin completes them.
function isPredictable(m: MatchData): boolean {
  return m.homeTeamName != null && m.awayTeamName != null && m.date != null;
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

  const groupMatches = useMemo(
    () => matches.filter((m) => m.round === "GROUP"),
    [matches],
  );
  const knockoutMatches = useMemo(
    () => matches.filter((m) => m.round !== "GROUP"),
    [matches],
  );

  // Progress counts only currently-predictable matches — TBD knockout rows
  // shouldn't make the total feel unreachable. Tracked per stage so the
  // card flips with the active tab and doesn't conflate the two.
  const groupPredictable = useMemo(
    () => groupMatches.filter(isPredictable),
    [groupMatches],
  );
  const groupDone = groupPredictable.filter((m) => predicted.has(m.id)).length;
  const knockoutPredictable = useMemo(
    () => knockoutMatches.filter(isPredictable),
    [knockoutMatches],
  );
  const knockoutDone = knockoutPredictable.filter((m) =>
    predicted.has(m.id),
  ).length;

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
      <Tabs defaultValue="knockout" className="gap-3">
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
            done={groupDone}
            total={groupPredictable.length}
            lockAt={isLocked ? null : lockAt}
          />
          {/* Global lock_at only applied to group-stage predictions. */}
          {isLocked && lockAt && <LockedBanner lockedAt={new Date(lockAt)} />}
          <GroupStageView
            matches={groupMatches}
            initialPredictions={initialPredictions}
            isLocked={isLocked}
            predicted={predicted}
            onPredictionStateChange={handlePredictionStateChange}
          />
        </TabsContent>

        <TabsContent value="knockout" className="space-y-4">
          <StageProgress
            done={knockoutDone}
            total={knockoutPredictable.length}
            lockAt={null}
          />
          {/* Knockout matches ignore the global deadline; each one is gated by
              its own predictions_locked flag (admin flips it at kickoff). */}
          <KnockoutView
            matches={knockoutMatches}
            initialPredictions={initialPredictions}
            predicted={predicted}
            onPredictionStateChange={handlePredictionStateChange}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StageProgress({
  done,
  total,
  lockAt,
}: {
  done: number;
  total: number;
  lockAt: string | null;
}) {
  return (
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
            {total === 0
              ? "No matches available yet."
              : done === total
                ? "All available matches predicted."
                : `${total - done} to go`}
          </p>
          {lockAt && (
            <Countdown variant="compact" lockAt={lockAt} className="mt-1" />
          )}
        </div>
      </div>
      <Progress
        value={total === 0 ? 0 : (done / total) * 100}
        className="mt-3 h-2"
      />
    </div>
  );
}

type StageProps = {
  matches: MatchData[];
  initialPredictions: Record<number, MatchPrediction>;
  isLocked: boolean;
  predicted: Set<number>;
  onPredictionStateChange: (matchId: number, complete: boolean) => void;
};

function GroupStageView({
  matches,
  initialPredictions,
  isLocked,
  predicted,
  onPredictionStateChange,
}: StageProps) {
  const matchesByGroup = useMemo(() => {
    const map = new Map<GroupCode, MatchData[]>();
    for (const code of GROUP_CODES) map.set(code, []);
    for (const m of matches) {
      const list = map.get(m.groupCode as GroupCode);
      if (list) list.push(m);
    }
    return map;
  }, [matches]);

  return (
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
                locked={isLocked || m.predictionsLocked}
                matchLocked={m.predictionsLocked && !isLocked}
                onPredictionStateChange={onPredictionStateChange}
              />
            ))}
          </TabsContent>
        );
      })}
    </Tabs>
  );
}

function KnockoutView({
  matches,
  initialPredictions,
  predicted,
  onPredictionStateChange,
}: Omit<StageProps, "isLocked">) {
  const matchesByRound = useMemo(() => {
    const map = new Map<KnockoutRound, MatchData[]>();
    for (const r of KNOCKOUT_ROUNDS) map.set(r, []);
    for (const m of matches) {
      const list = map.get(m.round as KnockoutRound);
      if (list) list.push(m);
    }
    return map;
  }, [matches]);

  // Default to the first round that has at least one confirmed fixture.
  const firstWithConfirmed =
    KNOCKOUT_ROUNDS.find(
      (r) => (matchesByRound.get(r) ?? []).some(isPredictable),
    ) ?? "R32";

  // No confirmed fixtures across any round → friendly empty state.
  if (!matches.some(isPredictable)) {
    return (
      <div className="rounded-lg border border-dashed bg-card p-6 text-center text-sm text-muted-foreground">
        Knockout fixtures will appear here as the bracket fills in.
      </div>
    );
  }

  return (
    <Tabs defaultValue={firstWithConfirmed} className="gap-3">
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <TabsList className="inline-flex w-auto">
          {KNOCKOUT_ROUNDS.map((r) => {
            const predictableHere = (matchesByRound.get(r) ?? []).filter(
              isPredictable,
            );
            const doneHere = predictableHere.filter((m) =>
              predicted.has(m.id),
            ).length;
            const complete =
              predictableHere.length > 0 &&
              doneHere === predictableHere.length;
            return (
              <TabsTrigger
                key={r}
                value={r}
                className="gap-1.5"
                disabled={predictableHere.length === 0}
              >
                <span className="font-semibold">{ROUND_SHORT[r]}</span>
                {predictableHere.length > 0 && (
                  <span
                    className={`text-[10px] tabular-nums ${
                      complete ? "text-success" : "text-muted-foreground"
                    }`}
                  >
                    {doneHere}/{predictableHere.length}
                  </span>
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>
      </div>

      {KNOCKOUT_ROUNDS.map((r) => {
        // Player view only shows fully-defined fixtures (both teams + date).
        // Half-filled rows live on /results so admin can complete them.
        const visible = (matchesByRound.get(r) ?? []).filter(isPredictable);
        return (
          <TabsContent key={r} value={r} className="space-y-3">
            {visible.length === 0 ? (
              <div className="rounded-lg border border-dashed bg-card p-6 text-center text-sm text-muted-foreground">
                No confirmed fixtures for this round yet.
              </div>
            ) : (
              visible.map((m) => (
                <MatchRow
                  key={m.id}
                  match={m}
                  dateLabel={formatDate(m.date)}
                  initial={initialPredictions[m.id]}
                  locked={m.predictionsLocked}
                  matchLocked={m.predictionsLocked}
                  onPredictionStateChange={onPredictionStateChange}
                />
              ))
            )}
          </TabsContent>
        );
      })}
    </Tabs>
  );
}

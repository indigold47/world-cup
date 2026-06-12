"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { flagFor } from "@/data/tournament";
import { saveMatchPrediction } from "./actions";
import { OthersPredictionsDialog } from "./others-predictions-dialog";
import type { MatchData, MatchPrediction } from "./match-predictor";

type SaveStatus = "idle" | "saving" | "saved" | "error";

type Props = {
  match: MatchData;
  dateLabel: string;
  initial: MatchPrediction | undefined;
  locked: boolean;
  /** True when this match is individually locked by admin (and the global deadline has not yet passed). */
  matchLocked?: boolean;
  onPredictionStateChange: (matchId: number, complete: boolean) => void;
};

const SAVE_DEBOUNCE_MS = 600;
const MAX_GOALS = 20;

function parseGoal(value: string): number | null {
  if (value === "") return null;
  const n = Number.parseInt(value, 10);
  if (!Number.isInteger(n) || n < 0 || n > MAX_GOALS) return null;
  return n;
}

export function MatchRow({
  match,
  dateLabel,
  initial,
  locked,
  matchLocked = false,
  onPredictionStateChange,
}: Props) {
  const [home, setHome] = useState<string>(
    initial ? String(initial.home) : "",
  );
  const [away, setAway] = useState<string>(
    initial ? String(initial.away) : "",
  );
  const [status, setStatus] = useState<SaveStatus>("idle");
  const timerRef = useRef<number | null>(null);
  const lastSavedRef = useRef<string>(
    initial ? `${initial.home}:${initial.away}` : "",
  );

  // Schedule a debounced save whenever both values are valid and changed.
  useEffect(() => {
    if (locked) return;
    const h = parseGoal(home);
    const a = parseGoal(away);

    // Report completion state to the parent immediately (local UI feels live).
    const isComplete = h !== null && a !== null;
    onPredictionStateChange(match.id, isComplete);

    if (!isComplete) {
      lastSavedRef.current = "";
      return;
    }

    const key = `${h}:${a}`;
    if (key === lastSavedRef.current) return;

    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(async () => {
      setStatus("saving");
      const result = await saveMatchPrediction(match.id, h, a);
      if (result.ok) {
        lastSavedRef.current = key;
        setStatus("saved");
        // Drop the "saved" indicator after a moment.
        window.setTimeout(() => {
          setStatus((s) => (s === "saved" ? "idle" : s));
        }, 1500);
      } else {
        setStatus("error");
        toast.error("Couldn't save", { description: result.error });
      }
    }, SAVE_DEBOUNCE_MS);

    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
    // We intentionally exclude onPredictionStateChange from deps — its identity
    // is stable enough from the parent's perspective, but adding it would cause
    // double-scheduling on render churn. The match.id, home, away, locked are
    // the real triggers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match.id, home, away, locked]);

  const isComplete = parseGoal(home) !== null && parseGoal(away) !== null;

  return (
    <article
      className={cn(
        "rounded-lg border bg-card p-3 sm:p-4 transition-colors",
        !isComplete && !locked && "border-dashed",
        locked && "opacity-90",
      )}
      aria-label={`Match ${match.matchNo}: ${match.homeTeamName} vs ${match.awayTeamName}`}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {dateLabel}
        </span>
        <SaveIndicator
          status={status}
          complete={isComplete}
          locked={locked}
          matchLocked={matchLocked}
        />
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-4">
        <TeamCell name={match.homeTeamName} side="home" />
        <div className="flex items-center gap-1.5 sm:gap-2">
          <GoalInput
            label={`${match.homeTeamName} goals`}
            value={home}
            onChange={setHome}
            disabled={locked}
          />
          <span className="text-base font-medium text-muted-foreground">:</span>
          <GoalInput
            label={`${match.awayTeamName} goals`}
            value={away}
            onChange={setAway}
            disabled={locked}
          />
        </div>
        <TeamCell name={match.awayTeamName} side="away" />
      </div>

      {locked && (
        <div className="mt-3 flex justify-end border-t pt-2">
          <OthersPredictionsDialog
            matchId={match.id}
            matchLabel={dateLabel}
            homeTeamName={match.homeTeamName}
            awayTeamName={match.awayTeamName}
          />
        </div>
      )}
    </article>
  );
}

function TeamCell({ name, side }: { name: string; side: "home" | "away" }) {
  const flag = flagFor(name);
  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-2",
        side === "away" && "justify-end text-right",
      )}
    >
      {side === "home" && (
        <span aria-hidden className="text-xl leading-none">
          {flag}
        </span>
      )}
      <span className="truncate text-sm font-medium">{name}</span>
      {side === "away" && (
        <span aria-hidden className="text-xl leading-none">
          {flag}
        </span>
      )}
    </div>
  );
}

function GoalInput({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <input
      aria-label={label}
      inputMode="numeric"
      pattern="[0-9]*"
      type="text"
      min={0}
      max={MAX_GOALS}
      value={value}
      onChange={(e) => {
        const v = e.target.value.replace(/[^0-9]/g, "").slice(0, 2);
        onChange(v);
      }}
      disabled={disabled}
      className={cn(
        "h-11 w-12 rounded-md border bg-background text-center text-xl font-semibold tabular-nums sm:h-12 sm:w-14 sm:text-2xl",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "disabled:cursor-not-allowed disabled:opacity-60",
      )}
      placeholder="–"
    />
  );
}

function SaveIndicator({
  status,
  complete,
  locked,
  matchLocked,
}: {
  status: SaveStatus;
  complete: boolean;
  locked: boolean;
  matchLocked: boolean;
}) {
  // aria-live=polite so screen readers announce save state changes
  // (saving → saved / failed) without interrupting the user.
  const wrap = (children: React.ReactNode, className = "") => (
    <span
      aria-live="polite"
      aria-atomic="true"
      className={`flex items-center gap-1 text-[11px] ${className}`}
    >
      {children}
    </span>
  );

  if (locked) {
    return wrap(
      matchLocked ? "Predictions blocked" : "Locked",
      "text-muted-foreground",
    );
  }
  if (status === "saving") {
    return wrap(
      <>
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> Saving…
      </>,
      "text-muted-foreground",
    );
  }
  if (status === "saved") {
    return wrap(
      <>
        <Check className="h-3 w-3" aria-hidden /> Saved
      </>,
      "font-medium text-success",
    );
  }
  if (status === "error") {
    return wrap(
      <>
        <AlertCircle className="h-3 w-3" aria-hidden /> Save failed
      </>,
      "font-medium text-destructive",
    );
  }
  if (!complete) return wrap("Not predicted", "text-muted-foreground");
  return wrap(null);
}

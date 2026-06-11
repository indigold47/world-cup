"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Check, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { flagFor } from "@/data/tournament";
import { Button } from "@/components/ui/button";
import { saveMatchResult, clearMatchResult } from "./actions";
import type { AdminMatchData } from "./match-results-editor";

type Status = "idle" | "saving" | "saved" | "error";

type Props = {
  match: AdminMatchData;
  dateLabel: string;
};

const MAX_GOALS = 30;

function parseGoal(value: string): number | null {
  if (value === "") return null;
  const n = Number.parseInt(value, 10);
  if (!Number.isInteger(n) || n < 0 || n > MAX_GOALS) return null;
  return n;
}

export function MatchResultRow({ match, dateLabel }: Props) {
  const [home, setHome] = useState<string>(
    match.homeGoals == null ? "" : String(match.homeGoals),
  );
  const [away, setAway] = useState<string>(
    match.awayGoals == null ? "" : String(match.awayGoals),
  );
  const [status, setStatus] = useState<Status>("idle");
  const [pending, startTransition] = useTransition();
  const [confirmingClear, setConfirmingClear] = useState(false);
  const clearResetTimer = useRef<number | null>(null);

  // Reset "Saved" indicator after a moment.
  useEffect(() => {
    if (status !== "saved") return;
    const id = window.setTimeout(() => setStatus("idle"), 1500);
    return () => window.clearTimeout(id);
  }, [status]);

  const isFinished = match.status === "finished";
  const baseline =
    match.homeGoals != null && match.awayGoals != null
      ? `${match.homeGoals}:${match.awayGoals}`
      : "";
  const currentKey = `${home}:${away}`;
  const dirty = currentKey !== baseline;

  const h = parseGoal(home);
  const a = parseGoal(away);
  const valid = h !== null && a !== null;

  function handleSave() {
    if (!valid) return;
    startTransition(async () => {
      setStatus("saving");
      const result = await saveMatchResult(match.id, h as number, a as number);
      if (result.ok) {
        setStatus("saved");
      } else {
        setStatus("error");
        toast.error("Couldn't save result", { description: result.error });
      }
    });
  }

  function handleClearTap() {
    if (!confirmingClear) {
      setConfirmingClear(true);
      if (clearResetTimer.current) window.clearTimeout(clearResetTimer.current);
      clearResetTimer.current = window.setTimeout(() => {
        setConfirmingClear(false);
      }, 3000);
      return;
    }
    if (clearResetTimer.current) window.clearTimeout(clearResetTimer.current);
    setConfirmingClear(false);
    startTransition(async () => {
      setStatus("saving");
      const result = await clearMatchResult(match.id);
      if (result.ok) {
        setHome("");
        setAway("");
        setStatus("saved");
      } else {
        setStatus("error");
        toast.error("Couldn't clear result", { description: result.error });
      }
    });
  }

  return (
    <article
      className={cn(
        "rounded-lg border bg-card p-3 sm:p-4 transition-colors",
        isFinished && !dirty && "border-success/40 bg-success/5",
        !isFinished && "border-dashed",
      )}
      aria-label={`Match ${match.matchNo}: ${match.homeTeamName} vs ${match.awayTeamName}`}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {dateLabel} · #{match.matchNo}
        </span>
        <StatusIndicator
          status={status}
          isFinished={isFinished}
          dirty={dirty}
        />
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-4">
        <TeamCell name={match.homeTeamName} side="home" />
        <div className="flex items-center gap-1.5 sm:gap-2">
          <GoalInput
            label={`${match.homeTeamName} goals`}
            value={home}
            onChange={setHome}
            disabled={pending}
          />
          <span className="text-base font-medium text-muted-foreground">:</span>
          <GoalInput
            label={`${match.awayTeamName} goals`}
            value={away}
            onChange={setAway}
            disabled={pending}
          />
        </div>
        <TeamCell name={match.awayTeamName} side="away" />
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
        {isFinished && (
          <Button
            type="button"
            variant={confirmingClear ? "destructive" : "ghost"}
            size="sm"
            disabled={pending}
            onClick={handleClearTap}
          >
            {confirmingClear ? "Tap again to clear" : "Clear result"}
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          disabled={!valid || pending || !dirty}
          onClick={handleSave}
        >
          {pending && status === "saving"
            ? "Saving…"
            : isFinished
              ? "Update result"
              : "Mark finished"}
        </Button>
      </div>
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

function StatusIndicator({
  status,
  isFinished,
  dirty,
}: {
  status: Status;
  isFinished: boolean;
  dirty: boolean;
}) {
  const wrap = (children: React.ReactNode, className = "") => (
    <span
      aria-live="polite"
      aria-atomic="true"
      className={`flex items-center gap-1 text-[11px] ${className}`}
    >
      {children}
    </span>
  );

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
  if (isFinished && !dirty) return wrap("Finished", "font-medium text-success");
  if (isFinished && dirty) return wrap("Unsaved edit", "text-muted-foreground");
  return wrap("Scheduled", "text-muted-foreground");
}

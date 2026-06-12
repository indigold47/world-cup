"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { flagFor } from "@/data/tournament";
import { getMatchPredictions, type OtherPrediction } from "./actions";

type Props = {
  matchId: number;
  matchLabel: string;
  homeTeamName: string;
  awayTeamName: string;
};

type LoadState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; predictions: OtherPrediction[]; matchFinished: boolean }
  | { kind: "error"; error: string };

export function OthersPredictionsDialog({
  matchId,
  matchLabel,
  homeTeamName,
  awayTeamName,
}: Props) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<LoadState>({ kind: "idle" });
  // Ref so the effect doesn't depend on `state` — depending on it would cause
  // the effect to re-run when we set "loading", cancel the inflight request,
  // and leave the dialog stuck on the spinner.
  const startedRef = useRef(false);

  useEffect(() => {
    if (!open || startedRef.current) return;
    startedRef.current = true;
    let cancelled = false;
    setState({ kind: "loading" });
    void getMatchPredictions(matchId).then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setState({
          kind: "ready",
          predictions: result.predictions,
          matchFinished: result.matchFinished,
        });
      } else {
        setState({ kind: "error", error: result.error });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [open, matchId]);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="xs"
        onClick={() => setOpen(true)}
      >
        <Users aria-hidden /> See others' predictions
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {flagFor(homeTeamName)} {homeTeamName} vs {awayTeamName}{" "}
              {flagFor(awayTeamName)}
            </DialogTitle>
            <DialogDescription>
              {matchLabel} · everyone's predictions
            </DialogDescription>
          </DialogHeader>
          <PredictionsBody state={state} />
        </DialogContent>
      </Dialog>
    </>
  );
}

function PredictionsBody({ state }: { state: LoadState }) {
  if (state.kind === "idle" || state.kind === "loading") {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        <span className="ml-2 text-sm">Loading…</span>
      </div>
    );
  }
  if (state.kind === "error") {
    return (
      <p className="py-6 text-center text-sm text-destructive">{state.error}</p>
    );
  }
  if (state.predictions.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        No one predicted this match.
      </p>
    );
  }
  return (
    <ul
      role="list"
      className="-mx-1 max-h-[60vh] overflow-y-auto px-1"
      aria-label="Predictions by user"
    >
      {state.predictions.map((p) => (
        <li
          key={p.userId}
          className="flex items-center justify-between gap-3 border-b py-2 last:border-b-0"
        >
          <span className="truncate text-sm font-medium">{p.displayName}</span>
          <div className="flex items-center gap-3 shrink-0">
            <span className="tabular-nums text-sm font-semibold">
              {p.home} <span className="text-muted-foreground">–</span> {p.away}
            </span>
            {state.matchFinished && <PointsBadge points={p.points ?? 0} />}
          </div>
        </li>
      ))}
    </ul>
  );
}

function PointsBadge({ points }: { points: number }) {
  const tone =
    points === 5
      ? "bg-success/10 text-success"
      : points === 2
        ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
        : "bg-muted text-muted-foreground";
  return (
    <span
      className={cn(
        "inline-flex h-5 min-w-9 items-center justify-center rounded-full px-2 text-[11px] font-semibold tabular-nums",
        tone,
      )}
      aria-label={`${points} points`}
    >
      {points} pt{points === 1 ? "" : "s"}
    </span>
  );
}

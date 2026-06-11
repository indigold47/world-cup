"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Loader2, AlertCircle, ChevronUp, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { flagFor } from "@/data/tournament";
import { saveGroupTable } from "./actions";
import type { GroupInitialOrder } from "./group-tables-predictor";

type SaveStatus = "idle" | "saving" | "saved" | "error";

type Props = {
  group: GroupInitialOrder;
  locked: boolean;
  ranked: boolean;
  onSaveSuccess: (groupCode: string) => void;
};

const SAVE_DEBOUNCE_MS = 600;

function swap<T>(arr: T[], i: number, j: number): T[] {
  if (i < 0 || j < 0 || i >= arr.length || j >= arr.length) return arr;
  const next = arr.slice();
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

export function GroupCard({ group, locked, ranked, onSaveSuccess }: Props) {
  const teamsById = new Map(group.teams.map((t) => [t.id, t]));
  const [order, setOrder] = useState<number[]>(group.orderedTeamIds);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const timerRef = useRef<number | null>(null);
  const lastSavedRef = useRef<string>(
    group.isPredicted ? group.orderedTeamIds.join(",") : "",
  );

  useEffect(() => {
    if (locked) return;
    const key = order.join(",");
    if (key === lastSavedRef.current) return;

    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(async () => {
      setStatus("saving");
      const result = await saveGroupTable(group.groupCode, order);
      if (result.ok) {
        lastSavedRef.current = key;
        setStatus("saved");
        onSaveSuccess(group.groupCode);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order, locked, group.groupCode]);

  const move = (idx: number, dir: -1 | 1) => {
    if (locked) return;
    setOrder((curr) => swap(curr, idx, idx + dir));
  };

  return (
    <article
      className={cn(
        "rounded-lg border bg-card p-4 transition-colors",
        !ranked && !locked && "border-dashed",
      )}
      aria-label={`Group ${group.groupCode}`}
    >
      <header className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Group
          </span>
          <span className="text-base font-semibold">{group.groupCode}</span>
        </div>
        <SaveIndicator status={status} ranked={ranked} locked={locked} />
      </header>

      <ol className="space-y-1.5">
        {order.map((teamId, idx) => {
          const team = teamsById.get(teamId);
          if (!team) return null;
          const isFirst = idx === 0;
          const isLast = idx === order.length - 1;
          return (
            <li
              key={teamId}
              className={cn(
                "flex items-center gap-2 rounded-md border bg-background py-2 pl-2 pr-1",
                idx === 0 && "border-primary/30 bg-primary/5",
              )}
            >
              <span
                aria-label={`Rank ${idx + 1}`}
                className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold tabular-nums"
              >
                {idx + 1}
              </span>
              <span aria-hidden className="text-lg leading-none">
                {flagFor(team.name)}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                {team.name}
              </span>
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  aria-label={`Move ${team.name} up`}
                  disabled={isFirst || locked}
                  onClick={() => move(idx, -1)}
                  className={cn(
                    "grid h-11 w-11 place-items-center rounded text-muted-foreground transition-colors",
                    "hover:bg-accent hover:text-foreground",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    "disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted-foreground",
                  )}
                >
                  <ChevronUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label={`Move ${team.name} down`}
                  disabled={isLast || locked}
                  onClick={() => move(idx, 1)}
                  className={cn(
                    "grid h-11 w-11 place-items-center rounded text-muted-foreground transition-colors",
                    "hover:bg-accent hover:text-foreground",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    "disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted-foreground",
                  )}
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
              </div>
            </li>
          );
        })}
      </ol>
    </article>
  );
}

function SaveIndicator({
  status,
  ranked,
  locked,
}: {
  status: SaveStatus;
  ranked: boolean;
  locked: boolean;
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

  if (locked) return wrap("Locked", "text-muted-foreground");
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
  if (!ranked) return wrap("Not ranked", "text-muted-foreground");
  return wrap(null);
}

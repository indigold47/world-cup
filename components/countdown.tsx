"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type Props = {
  /** ISO string or Date — the moment predictions lock. */
  lockAt: string | Date;
  /** "default" is a multi-unit display block; "compact" is a one-line summary. */
  variant?: "default" | "compact";
  className?: string;
};

type Parts = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
};

function diffParts(target: number, now: number): Parts {
  const ms = Math.max(0, target - now);
  const totalSeconds = Math.floor(ms / 1000);
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  };
}

function isZero(p: Parts): boolean {
  return p.days === 0 && p.hours === 0 && p.minutes === 0 && p.seconds === 0;
}

/** Show two largest non-zero units, dropping smaller noise. */
function compactString(p: Parts): string {
  if (p.days > 0) return `${p.days}d ${p.hours}h`;
  if (p.hours > 0) return `${p.hours}h ${p.minutes}m`;
  if (p.minutes > 0) return `${p.minutes}m ${p.seconds}s`;
  return `${p.seconds}s`;
}

export function Countdown({ lockAt, variant = "default", className }: Props) {
  const target =
    typeof lockAt === "string" ? new Date(lockAt).getTime() : lockAt.getTime();
  const [parts, setParts] = useState<Parts>(() =>
    diffParts(target, Date.now()),
  );

  useEffect(() => {
    const id = window.setInterval(() => {
      setParts(diffParts(target, Date.now()));
    }, 1000);
    return () => window.clearInterval(id);
  }, [target]);

  const locked = isZero(parts);

  if (variant === "compact") {
    if (locked) {
      return (
        <span className={cn("text-xs text-muted-foreground", className)}>
          Locked
        </span>
      );
    }
    return (
      <span
        aria-label="Time until predictions lock"
        className={cn(
          "inline-flex items-center gap-1 text-xs font-medium text-muted-foreground tabular-nums",
          className,
        )}
      >
        <span className="text-foreground">{compactString(parts)}</span>
        <span>left</span>
      </span>
    );
  }

  if (locked) {
    return (
      <p className={cn("text-sm font-medium text-muted-foreground", className)}>
        Predictions are locked.
      </p>
    );
  }

  return (
    <ol
      aria-label="Time until predictions lock"
      className={cn("flex items-baseline gap-3 tabular-nums", className)}
    >
      <Unit value={parts.days} label="days" />
      <Unit value={parts.hours} label="hrs" />
      <Unit value={parts.minutes} label="min" />
      <Unit value={parts.seconds} label="sec" subtle />
    </ol>
  );
}

function Unit({
  value,
  label,
  subtle,
}: {
  value: number;
  label: string;
  subtle?: boolean;
}) {
  return (
    <li className="flex flex-col items-start">
      <span
        className={cn(
          "text-2xl font-semibold tracking-tight sm:text-3xl",
          subtle && "text-muted-foreground",
        )}
      >
        {String(value).padStart(2, "0")}
      </span>
      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
    </li>
  );
}

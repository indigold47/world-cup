"use client";

import { useState, useTransition } from "react";
import { Clock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateLockAt } from "./actions";

type Props = {
  /** Current lock_at as a UTC ISO string. */
  currentLockAt: string | null;
};

function toDatetimeLocalValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  // datetime-local wants YYYY-MM-DDTHH:mm in the user's local timezone.
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const FORMATTER = new Intl.DateTimeFormat(undefined, {
  dateStyle: "full",
  timeStyle: "short",
  timeZoneName: "short",
});

export function LockEditor({ currentLockAt }: Props) {
  const [value, setValue] = useState<string>(() =>
    toDatetimeLocalValue(currentLockAt),
  );
  const [pending, startTransition] = useTransition();

  const currentLabel = currentLockAt
    ? FORMATTER.format(new Date(currentLockAt))
    : "Not set";

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!value) {
      toast.error("Pick a date and time first.");
      return;
    }
    // Treat the datetime-local string as local time, convert to UTC ISO.
    const utcIso = new Date(value).toISOString();
    startTransition(async () => {
      const result = await updateLockAt(utcIso);
      if (result.ok) {
        toast.success("Deadline updated", { description: currentLabel });
      } else {
        toast.error("Couldn't update", { description: result.error });
      }
    });
  }

  return (
    <section className="rounded-lg border bg-card p-4 sm:p-5">
      <header className="mb-4 flex items-start gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
          <Clock className="h-4 w-4" aria-hidden />
        </div>
        <div>
          <h2 className="text-sm font-semibold">Prediction deadline</h2>
          <p className="text-xs text-muted-foreground">
            After this moment, predictions become read-only for everyone.
          </p>
        </div>
      </header>

      <dl className="mb-4 grid grid-cols-1 gap-1 rounded-md bg-muted/40 px-3 py-2 text-xs">
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted-foreground">Current</dt>
          <dd className="text-right tabular-nums">{currentLabel}</dd>
        </div>
      </dl>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="lock_at">New deadline (your local time)</Label>
          <Input
            id="lock_at"
            name="lock_at"
            type="datetime-local"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            required
          />
          <p className="text-xs text-muted-foreground">
            Stored in UTC. The number you type is interpreted in {Intl.DateTimeFormat().resolvedOptions().timeZone}.
          </p>
        </div>
        <Button type="submit" disabled={pending} size="sm">
          {pending ? "Saving…" : "Save deadline"}
        </Button>
      </form>
    </section>
  );
}

"use client";

import { useState } from "react";
import { Progress } from "@/components/ui/progress";
import { LockedBanner } from "@/components/locked-banner";
import { Countdown } from "@/components/countdown";
import { type GroupCode } from "@/data/tournament";
import { GroupCard } from "./group-card";

export type GroupInitialOrder = {
  groupCode: GroupCode;
  teams: Array<{ id: number; name: string }>;
  orderedTeamIds: number[];
  isPredicted: boolean;
};

type Props = {
  initialOrders: GroupInitialOrder[];
  isLocked: boolean;
  lockAt: string | null;
};

export function GroupTablesPredictor({
  initialOrders,
  isLocked,
  lockAt,
}: Props) {
  const [rankedGroups, setRankedGroups] = useState<Set<string>>(
    () => new Set(initialOrders.filter((g) => g.isPredicted).map((g) => g.groupCode)),
  );

  const total = initialOrders.length;
  const done = rankedGroups.size;

  const handleSaveSuccess = (groupCode: string) => {
    setRankedGroups((prev) => {
      if (prev.has(groupCode)) return prev;
      const next = new Set(prev);
      next.add(groupCode);
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
                ? "All groups ranked."
                : `${total - done} to rank`}
            </p>
            {!isLocked && lockAt && (
              <Countdown variant="compact" lockAt={lockAt} className="mt-1" />
            )}
          </div>
        </div>
        <Progress
          value={total === 0 ? 0 : (done / total) * 100}
          className="mt-3 h-2"
        />
      </div>

      {isLocked && lockAt && <LockedBanner lockedAt={new Date(lockAt)} />}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {initialOrders.map((group) => (
          <GroupCard
            key={group.groupCode}
            group={group}
            locked={isLocked}
            onSaveSuccess={handleSaveSuccess}
            ranked={rankedGroups.has(group.groupCode)}
          />
        ))}
      </div>
    </div>
  );
}

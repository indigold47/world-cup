"use client";

import Link from "next/link";
import { useState } from "react";
import { Sparkles } from "lucide-react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { cn } from "@/lib/utils";
import type { LeaderboardRow } from "@/lib/scoring/leaderboard";

type Props = {
  allRows: LeaderboardRow[];
  groupRows: LeaderboardRow[];
  knockoutRows: LeaderboardRow[];
  currentUserId: string;
};

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export function LeaderboardView({
  allRows,
  groupRows,
  knockoutRows,
  currentUserId,
}: Props) {
  const [tab, setTab] = useState<"all" | "group" | "knockout">("all");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="group">Group stage</TabsTrigger>
            <TabsTrigger value="knockout">Knockout</TabsTrigger>
          </TabsList>
        </Tabs>
        <Button
          render={<Link href="/leaderboard/me" />}
          nativeButton={false}
          variant="outline"
          size="sm"
        >
          My scorecard
        </Button>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsContent value="all">
          <RowList rows={allRows} currentUserId={currentUserId} stage="all" />
        </TabsContent>
        <TabsContent value="group">
          <RowList rows={groupRows} currentUserId={currentUserId} stage="group" />
        </TabsContent>
        <TabsContent value="knockout">
          <RowList
            rows={knockoutRows}
            currentUserId={currentUserId}
            stage="knockout"
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function RowList({
  rows,
  currentUserId,
  stage,
}: {
  rows: LeaderboardRow[];
  currentUserId: string;
  stage: "all" | "group" | "knockout";
}) {
  const anyPoints = rows.some((r) => r.stage_points > 0);
  if (!anyPoints) {
    return (
      <EmptyState
        icon={<Sparkles className="h-5 w-5" />}
        title={
          stage === "knockout"
            ? "Knockout hasn't started yet"
            : "No points yet"
        }
        description={
          stage === "knockout"
            ? "Points appear here as knockout matches finish."
            : "Predictions are locked in. Points start landing the moment the first match finishes."
        }
      />
    );
  }
  return (
    <ol className="flex flex-col gap-2">
      {rows.map((row) => (
        <LeaderboardRowCard
          key={row.user_id}
          row={row}
          isCurrentUser={row.user_id === currentUserId}
        />
      ))}
    </ol>
  );
}

function LeaderboardRowCard({
  row,
  isCurrentUser,
}: {
  row: LeaderboardRow;
  isCurrentUser: boolean;
}) {
  const podium = row.rank <= 3 && row.stage_points > 0;
  const inner = (
    <article
      aria-current={isCurrentUser ? "true" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-lg border bg-card p-3 sm:gap-4 sm:p-4 transition-colors",
        isCurrentUser && "border-primary/40 bg-primary/5 ring-1 ring-primary/20",
        podium && !isCurrentUser && "border-success/30",
      )}
    >
      <div
        className={cn(
          "grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-semibold tabular-nums",
          podium
            ? "bg-primary/15 text-primary"
            : "bg-muted text-muted-foreground",
        )}
        aria-label={`Rank ${row.rank}`}
      >
        {row.rank}
      </div>

      <Avatar className="h-9 w-9 shrink-0">
        <AvatarFallback className="text-xs font-medium">
          {initialsOf(row.display_name) || "?"}
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold sm:text-base">
          {row.display_name}
          {isCurrentUser && (
            <span className="ml-2 text-xs font-medium text-primary">
              (you)
            </span>
          )}
        </p>
        <p className="text-xs text-muted-foreground">
          {row.exact_hits} exact score{row.exact_hits === 1 ? "" : "s"}
        </p>
      </div>

      <div className="text-right">
        <p className="text-xl font-semibold tabular-nums sm:text-2xl">
          {row.stage_points}
        </p>
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          pts
        </p>
      </div>

      {row.exact_hits > 0 && (
        <Badge
          variant="secondary"
          className="hidden gap-1 bg-success/10 text-success border-success/20 sm:inline-flex"
        >
          <Sparkles className="h-3 w-3" /> {row.exact_hits}
        </Badge>
      )}
    </article>
  );

  if (isCurrentUser) {
    return (
      <li>
        <Link
          href="/leaderboard/me"
          className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-lg"
        >
          {inner}
        </Link>
      </li>
    );
  }

  return <li>{inner}</li>;
}

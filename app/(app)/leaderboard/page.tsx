import Link from "next/link";
import { redirect } from "next/navigation";
import { Trophy, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const metadata = { title: "Leaderboard · Voice123 World Cup Pool" };
// Always read fresh — recompute writes to the underlying tables and this page
// should reflect the new totals immediately after admins enter results.
export const dynamic = "force-dynamic";

type LeaderboardRow = {
  user_id: string;
  display_name: string;
  first_submitted_at: string | null;
  total_points: number;
  exact_hits: number;
  rank: number;
};

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export default async function LeaderboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data, error } = await supabase.rpc("get_leaderboard");
  const rows = (data ?? []) as LeaderboardRow[];
  const anyPoints = rows.some((r) => r.total_points > 0);

  return (
    <main className="flex flex-col gap-6 py-6 sm:py-10">
      <PageHeader
        eyebrow="Live standings"
        title="Leaderboard"
        subtitle="Ranked by total points, then exact-score hits, then earliest first submission."
        action={
          <Button
            render={<Link href="/leaderboard/me" />}
            nativeButton={false}
            variant="outline"
            size="sm"
          >
            View my scorecard
          </Button>
        }
      />

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
          <p className="font-medium text-destructive">
            Couldn&apos;t load the leaderboard
          </p>
          <p className="text-destructive/80">{error.message}</p>
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState
          icon={<Trophy className="h-5 w-5" />}
          title="Nobody's joined yet"
          description="The leaderboard fills up as colleagues sign in and submit their first prediction."
        />
      ) : !anyPoints ? (
        <EmptyState
          icon={<Sparkles className="h-5 w-5" />}
          title="No results yet"
          description="Predictions are locked in. May the best colleague win — points start landing the moment the first match finishes."
        />
      ) : (
        <ol className="flex flex-col gap-2">
          {rows.map((row) => (
            <LeaderboardRow
              key={row.user_id}
              row={row}
              isCurrentUser={row.user_id === user.id}
            />
          ))}
        </ol>
      )}
    </main>
  );
}

function LeaderboardRow({
  row,
  isCurrentUser,
}: {
  row: LeaderboardRow;
  isCurrentUser: boolean;
}) {
  const podium = row.rank <= 3 && row.total_points > 0;
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
          {row.total_points}
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

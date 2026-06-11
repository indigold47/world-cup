import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { StatPill } from "@/components/stat-pill";
import { Countdown } from "@/components/countdown";
import { LockedBanner } from "@/components/locked-banner";
import { Goal, ListOrdered, Trophy } from "lucide-react";

const TOTAL_MATCHES = 72;
const TOTAL_GROUPS = 12;

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null; // proxy + layout already gate this

  const [{ data: profile }, { data: settings }, matchCountRes, groupCountRes] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("display_name")
        .eq("id", user.id)
        .single(),
      supabase.from("settings").select("lock_at").eq("id", 1).single(),
      supabase
        .from("match_predictions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id),
      supabase
        .from("group_table_predictions")
        .select("group_code", { count: "exact", head: false })
        .eq("user_id", user.id),
    ]);

  const firstName = profile?.display_name.split(/\s+/)[0] ?? "there";
  const matchesDone = matchCountRes.count ?? 0;
  const groupsDone =
    new Set((groupCountRes.data ?? []).map((row) => row.group_code)).size;

  const lockAt = settings?.lock_at ? new Date(settings.lock_at) : null;
  const isLocked = lockAt ? Date.now() >= lockAt.getTime() : false;

  return (
    <main className="flex flex-col gap-8 py-6 sm:py-10">
      <PageHeader
        eyebrow="Voice123 World Cup 2026"
        title={`Welcome back, ${firstName}.`}
        subtitle="Lock in your predictions before kickoff. Watch the leaderboard fill up as results come in."
      />

      {isLocked && lockAt ? (
        <LockedBanner lockedAt={lockAt} />
      ) : (
        <SectionCard
          title="Time to lock"
          description="Your picks freeze the moment the timer hits zero."
        >
          {lockAt ? (
            <Countdown lockAt={lockAt} />
          ) : (
            <p className="text-sm text-muted-foreground">
              The admin hasn't set a deadline yet.
            </p>
          )}
        </SectionCard>
      )}

      <SectionCard
        title="Your predictions"
        description="Match scores and the order each group will finish in."
        action={
          <div className="hidden gap-2 sm:flex">
            <Button
              render={<Link href="/matches" />}
              nativeButton={false}
              variant="outline"
              size="sm"
            >
              Matches
            </Button>
            <Button
              render={<Link href="/group-tables" />}
              nativeButton={false}
              variant="outline"
              size="sm"
            >
              Groups
            </Button>
          </div>
        }
        contentClassName="grid gap-3 sm:grid-cols-2"
      >
        <StatPill
          label="Matches predicted"
          value={`${matchesDone} / ${TOTAL_MATCHES}`}
          hint={
            matchesDone === TOTAL_MATCHES
              ? "All in. Nice."
              : `${TOTAL_MATCHES - matchesDone} left to go`
          }
          variant={matchesDone === TOTAL_MATCHES ? "success" : "default"}
        />
        <StatPill
          label="Groups ranked"
          value={`${groupsDone} / ${TOTAL_GROUPS}`}
          hint={
            groupsDone === TOTAL_GROUPS
              ? "Every group ordered."
              : `${TOTAL_GROUPS - groupsDone} to rank`
          }
          variant={groupsDone === TOTAL_GROUPS ? "success" : "default"}
        />
      </SectionCard>

      <div className="grid gap-3 sm:grid-cols-3">
        <QuickLink
          href="/matches"
          title="Predict matches"
          description="72 fixtures, one score per match."
          icon={<Goal className="h-5 w-5" />}
        />
        <QuickLink
          href="/group-tables"
          title="Rank groups"
          description="Order 1st → 4th for each of 12 groups."
          icon={<ListOrdered className="h-5 w-5" />}
        />
        <QuickLink
          href="/leaderboard"
          title="Leaderboard"
          description="Who's leading the pool right now."
          icon={<Trophy className="h-5 w-5" />}
        />
      </div>
    </main>
  );
}

function QuickLink({
  href,
  title,
  description,
  icon,
}: {
  href: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group rounded-lg border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
        {icon}
      </div>
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
    </Link>
  );
}

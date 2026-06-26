import { redirect } from "next/navigation";
import { Trophy } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { rankLeaderboard, type LeaderboardStage } from "@/lib/scoring/leaderboard";
import { LeaderboardView } from "./leaderboard-view";

export const metadata = { title: "Leaderboard · Voice123 World Cup Pool" };
// Always read fresh — recomputeScores writes to the prediction cache and this
// page should reflect the new totals immediately after admins enter results.
export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  // Cross-user read: bypass RLS via service role. The "own only" SELECT
  // policy on predictions is correct for general user access (don't leak
  // others' picks pre-deadline), but the leaderboard is a server-only
  // aggregation that's already part of the in-pool experience, so it can
  // read everyone's points.
  const admin = createAdminClient();
  const [profilesRes, matchPredsRes, groupPredsRes, matchesRes] = await Promise.all([
    admin.from("profiles").select("id, display_name, first_submitted_at"),
    admin.from("match_predictions").select("user_id, match_id, points"),
    admin.from("group_table_predictions").select("user_id, points"),
    // match_no per match — drives the group/knockout split below.
    admin.from("matches").select("id, match_no"),
  ]);

  const firstError =
    profilesRes.error ??
    matchPredsRes.error ??
    groupPredsRes.error ??
    matchesRes.error;

  const matchStageById = new Map<number, "group" | "knockout">();
  for (const m of matchesRes.data ?? []) {
    matchStageById.set(m.id, m.match_no <= 72 ? "group" : "knockout");
  }

  // Pre-rank all three views server-side so the client toggle is instant.
  const rankFor = (stage: LeaderboardStage) =>
    firstError
      ? []
      : rankLeaderboard({
          profiles: profilesRes.data ?? [],
          matchPredictions: matchPredsRes.data ?? [],
          groupPredictions: groupPredsRes.data ?? [],
          matchStageById,
          stage,
        });

  const all = rankFor("all");
  const group = rankFor("group");
  const knockout = rankFor("knockout");

  return (
    <main className="flex flex-col gap-6 py-6 sm:py-10">
      <PageHeader
        eyebrow="Live standings"
        title="Leaderboard"
        subtitle="Ranked by points, then exact-score hits, then earliest first submission."
      />

      {firstError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
          <p className="font-medium text-destructive">
            Couldn&apos;t load the leaderboard
          </p>
          <p className="text-destructive/80">{firstError.message}</p>
        </div>
      )}

      {all.length === 0 ? (
        <EmptyState
          icon={<Trophy className="h-5 w-5" />}
          title="Nobody's joined yet"
          description="The leaderboard fills up as colleagues sign in and submit their first prediction."
        />
      ) : (
        <LeaderboardView
          allRows={all}
          groupRows={group}
          knockoutRows={knockout}
          currentUserId={user.id}
        />
      )}
    </main>
  );
}

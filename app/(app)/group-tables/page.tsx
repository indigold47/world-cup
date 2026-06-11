import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { GROUP_CODES, type GroupCode } from "@/data/tournament";
import {
  GroupTablesPredictor,
  type GroupInitialOrder,
} from "./group-tables-predictor";

export const metadata = { title: "Group tables · Voice123 World Cup Pool" };

export default async function GroupTablesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const [teamsRes, predictionsRes, settingsRes] = await Promise.all([
    supabase.from("teams").select("id, name, group_code"),
    supabase
      .from("group_table_predictions")
      .select("group_code, team_id, predicted_rank")
      .eq("user_id", user.id),
    supabase.from("settings").select("lock_at").eq("id", 1).single(),
  ]);

  const teamsByGroup = new Map<
    GroupCode,
    Array<{ id: number; name: string }>
  >();
  for (const code of GROUP_CODES) teamsByGroup.set(code, []);
  for (const t of teamsRes.data ?? []) {
    const list = teamsByGroup.get(t.group_code as GroupCode);
    if (list) list.push({ id: t.id, name: t.name });
  }

  // Default order = seeded team order within each group. Stable by team id
  // (insertion order in the migration is the canonical "default").
  for (const list of teamsByGroup.values()) {
    list.sort((a, b) => a.id - b.id);
  }

  // Apply existing predictions: build a {group_code -> orderedTeamIds[]} map.
  const predictedRanks = new Map<GroupCode, Array<number | undefined>>();
  for (const row of predictionsRes.data ?? []) {
    const code = row.group_code as GroupCode;
    if (!predictedRanks.has(code)) {
      predictedRanks.set(code, [undefined, undefined, undefined, undefined]);
    }
    const ranks = predictedRanks.get(code)!;
    if (row.predicted_rank >= 1 && row.predicted_rank <= 4) {
      ranks[row.predicted_rank - 1] = row.team_id;
    }
  }

  const initialOrders: GroupInitialOrder[] = GROUP_CODES.map((code) => {
    const teams = teamsByGroup.get(code) ?? [];
    const predicted = predictedRanks.get(code);
    const isPredicted =
      Array.isArray(predicted) &&
      predicted.length === 4 &&
      predicted.every((id): id is number => typeof id === "number");

    const orderedIds = isPredicted
      ? (predicted as number[])
      : teams.map((t) => t.id);

    return {
      groupCode: code,
      teams,
      orderedTeamIds: orderedIds,
      isPredicted,
    };
  });

  const lockAt = settingsRes.data?.lock_at ?? null;
  const isLocked = lockAt ? Date.now() >= new Date(lockAt).getTime() : false;

  return (
    <main className="flex flex-col gap-6 py-6 sm:py-10">
      <PageHeader
        eyebrow="Group stage"
        title="Rank each group"
        subtitle="Order the four teams from first to fourth. Tap the arrows to reorder."
      />
      <GroupTablesPredictor
        initialOrders={initialOrders}
        isLocked={isLocked}
        lockAt={lockAt}
      />
    </main>
  );
}

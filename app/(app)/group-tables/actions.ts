"use server";

import { createClient } from "@/lib/supabase/server";

export type SaveGroupTableResult =
  | { ok: true }
  | { ok: false; error: string };

const VALID_GROUP_CODES = new Set([
  "A","B","C","D","E","F","G","H","I","J","K","L",
]);

export async function saveGroupTable(
  groupCode: string,
  orderedTeamIds: number[],
): Promise<SaveGroupTableResult> {
  if (!VALID_GROUP_CODES.has(groupCode)) {
    return { ok: false, error: "Invalid group" };
  }
  if (
    !Array.isArray(orderedTeamIds) ||
    orderedTeamIds.length !== 4 ||
    !orderedTeamIds.every((id) => Number.isInteger(id))
  ) {
    return { ok: false, error: "Need exactly 4 team ranks" };
  }
  if (new Set(orderedTeamIds).size !== 4) {
    return { ok: false, error: "Each team can only appear once" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You're not signed in" };

  // Defensive lock check — DB trigger is the real gate.
  const { data: settings } = await supabase
    .from("settings")
    .select("lock_at")
    .eq("id", 1)
    .single();
  if (
    settings?.lock_at &&
    Date.now() >= new Date(settings.lock_at).getTime()
  ) {
    return { ok: false, error: "Predictions are locked" };
  }

  // Validate that all 4 teams actually belong to this group — guards against
  // a client sending IDs from a different group.
  const { data: teams } = await supabase
    .from("teams")
    .select("id, group_code")
    .in("id", orderedTeamIds);
  if (
    !teams ||
    teams.length !== 4 ||
    teams.some((t) => t.group_code !== groupCode)
  ) {
    return { ok: false, error: "Teams don't all belong to this group" };
  }

  // Delete + insert: the schema has unique(user_id, group_code, predicted_rank),
  // so we can't piecemeal-update ranks without risking collisions. Wiping the
  // group's rows and re-inserting fresh is the simplest path.
  const { error: deleteError } = await supabase
    .from("group_table_predictions")
    .delete()
    .eq("user_id", user.id)
    .eq("group_code", groupCode);
  if (deleteError) return { ok: false, error: deleteError.message };

  const rows = orderedTeamIds.map((teamId, idx) => ({
    user_id: user.id,
    group_code: groupCode,
    team_id: teamId,
    predicted_rank: idx + 1,
  }));
  const { error: insertError } = await supabase
    .from("group_table_predictions")
    .insert(rows);
  if (insertError) return { ok: false, error: insertError.message };

  // Tie-break #3: set once.
  await supabase
    .from("profiles")
    .update({ first_submitted_at: new Date().toISOString() })
    .eq("id", user.id)
    .is("first_submitted_at", null);

  return { ok: true };
}

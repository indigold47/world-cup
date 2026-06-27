"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { recomputeScores } from "@/lib/scoring/recompute";

export type ActionResult = { ok: true } | { ok: false; error: string };

const MAX_GOALS = 30;

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, error: "You're not signed in" as const };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") {
    return { supabase, error: "Admin only" as const };
  }
  return { supabase, error: null };
}

export async function updateLockAt(isoString: string): Promise<ActionResult> {
  if (typeof isoString !== "string" || isoString.length === 0) {
    return { ok: false, error: "Pick a date and time." };
  }
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return { ok: false, error: "That doesn't look like a valid date." };
  }

  const { supabase, error: adminError } = await requireAdmin();
  if (adminError) return { ok: false, error: adminError };

  const { error } = await supabase
    .from("settings")
    .update({ lock_at: date.toISOString() })
    .eq("id", 1);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

function isValidGoal(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= MAX_GOALS;
}

export async function saveMatchResult(
  matchId: number,
  homeGoals: number,
  awayGoals: number,
): Promise<ActionResult> {
  if (!Number.isInteger(matchId)) {
    return { ok: false, error: "Invalid match id" };
  }
  if (!isValidGoal(homeGoals) || !isValidGoal(awayGoals)) {
    return { ok: false, error: `Goals must be 0–${MAX_GOALS}` };
  }

  const { supabase, error: adminError } = await requireAdmin();
  if (adminError) return { ok: false, error: adminError };

  const { error } = await supabase
    .from("matches")
    .update({
      home_goals: homeGoals,
      away_goals: awayGoals,
      status: "finished",
    })
    .eq("id", matchId);
  if (error) return { ok: false, error: error.message };

  const recompute = await recomputeScores();
  if (!recompute.ok) {
    return {
      ok: false,
      error: `Result saved, but scoring failed: ${recompute.error}`,
    };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function setMatchPredictionLock(
  matchId: number,
  locked: boolean,
): Promise<ActionResult> {
  if (!Number.isInteger(matchId)) {
    return { ok: false, error: "Invalid match id" };
  }
  if (typeof locked !== "boolean") {
    return { ok: false, error: "Invalid lock state" };
  }

  const { supabase, error: adminError } = await requireAdmin();
  if (adminError) return { ok: false, error: adminError };

  const { error } = await supabase
    .from("matches")
    .update({ predictions_locked: locked })
    .eq("id", matchId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function setKnockoutTeams(
  matchId: number,
  homeTeamId: number | null,
  awayTeamId: number | null,
): Promise<ActionResult> {
  if (!Number.isInteger(matchId)) {
    return { ok: false, error: "Invalid match id" };
  }
  if (homeTeamId != null && !Number.isInteger(homeTeamId)) {
    return { ok: false, error: "Invalid home team id" };
  }
  if (awayTeamId != null && !Number.isInteger(awayTeamId)) {
    return { ok: false, error: "Invalid away team id" };
  }
  if (homeTeamId != null && homeTeamId === awayTeamId) {
    return { ok: false, error: "Home and away teams must differ" };
  }

  const { supabase, error: adminError } = await requireAdmin();
  if (adminError) return { ok: false, error: adminError };

  // Group-stage rows (match_no 1..72) are seeded — never overwrite them.
  const { data: existing, error: readErr } = await supabase
    .from("matches")
    .select("match_no")
    .eq("id", matchId)
    .single();
  if (readErr) return { ok: false, error: readErr.message };
  if ((existing?.match_no ?? 0) <= 72) {
    return { ok: false, error: "Group-stage teams are set by the seed." };
  }

  const { error } = await supabase
    .from("matches")
    .update({
      home_team_id: homeTeamId,
      away_team_id: awayTeamId,
    })
    .eq("id", matchId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function setKnockoutDate(
  matchId: number,
  dateISO: string | null,
): Promise<ActionResult> {
  if (!Number.isInteger(matchId)) {
    return { ok: false, error: "Invalid match id" };
  }
  // Accept "" / null as "clear the date". Otherwise require YYYY-MM-DD.
  let normalized: string | null = null;
  if (dateISO != null && dateISO !== "") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) {
      return { ok: false, error: "Date must be YYYY-MM-DD" };
    }
    normalized = dateISO;
  }

  const { supabase, error: adminError } = await requireAdmin();
  if (adminError) return { ok: false, error: adminError };

  const { data: existing, error: readErr } = await supabase
    .from("matches")
    .select("match_no")
    .eq("id", matchId)
    .single();
  if (readErr) return { ok: false, error: readErr.message };
  if ((existing?.match_no ?? 0) <= 72) {
    return { ok: false, error: "Group-stage dates are fixed by the seed." };
  }

  const { error } = await supabase
    .from("matches")
    .update({ match_date: normalized })
    .eq("id", matchId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function clearMatchResult(matchId: number): Promise<ActionResult> {
  if (!Number.isInteger(matchId)) {
    return { ok: false, error: "Invalid match id" };
  }

  const { supabase, error: adminError } = await requireAdmin();
  if (adminError) return { ok: false, error: adminError };

  const { error } = await supabase
    .from("matches")
    .update({
      home_goals: null,
      away_goals: null,
      status: "scheduled",
    })
    .eq("id", matchId);
  if (error) return { ok: false, error: error.message };

  const recompute = await recomputeScores();
  if (!recompute.ok) {
    return {
      ok: false,
      error: `Result cleared, but scoring failed: ${recompute.error}`,
    };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

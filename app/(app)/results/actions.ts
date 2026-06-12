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
      error: `Result saved, but scoring failed: ${recompute.error ?? "unknown error"}`,
    };
  }
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
      error: `Result cleared, but scoring failed: ${recompute.error ?? "unknown error"}`,
    };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

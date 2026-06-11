"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/sign-in");
}

export type UpdateDisplayNameResult =
  | { ok: true }
  | { ok: false; error: string };

export async function updateDisplayName(
  formData: FormData,
): Promise<UpdateDisplayNameResult> {
  const raw = formData.get("display_name");
  if (typeof raw !== "string") {
    return { ok: false, error: "Please enter a name." };
  }

  const name = raw.trim();
  if (name.length === 0) {
    return { ok: false, error: "Name can't be empty." };
  }
  if (name.length > 60) {
    return { ok: false, error: "Name must be 60 characters or fewer." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "You're not signed in." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ display_name: name })
    .eq("id", user.id);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

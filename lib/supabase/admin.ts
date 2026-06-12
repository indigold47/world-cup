import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

/**
 * Service-role Supabase client. Bypasses RLS — only use in trusted server code,
 * never in a request handler that runs with user input untrusted.
 *
 * Specifically used by lib/scoring/recompute.ts so the scoring engine can
 * rewrite .points on every prediction in one pass. The "own only" RLS policy
 * on the prediction tables would otherwise reject writes to other users' rows.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
  }
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  }
  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

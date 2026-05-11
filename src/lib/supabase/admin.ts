import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { getClientEnv, getServiceRoleKey } from "@/env";

/**
 * Service-role client for trusted server routes only (invite user, etc.).
 */
export function createServiceSupabaseClient() {
  const key = getServiceRoleKey();
  if (!key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
  }
  const env = getClientEnv();
  return createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

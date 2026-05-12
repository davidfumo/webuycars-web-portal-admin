import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export const PORTAL_PENDING_DEALER_ID = "portal_pending_dealer_id";
export const PORTAL_PENDING_STAFF_ROLE = "portal_pending_staff_role";

type ServiceClient = SupabaseClient<Database>;

/**
 * Stamps Supabase Auth **app_metadata** (users cannot forge this from the client).
 * After first login / password, `/api/auth/sync-portal-membership` upserts `dealer_staff`
 * from these keys so invited managers are never "orphaned" if a prior DB step failed.
 */
export async function stampPortalPendingDealerInvite(
  service: ServiceClient,
  authUserId: string,
  dealerId: string,
  staffRole: "manager" | "staff",
): Promise<void> {
  const { data: res, error } = await service.auth.admin.getUserById(authUserId);
  if (error || !res?.user) return;
  const prev = (res.user.app_metadata ?? {}) as Record<string, unknown>;
  await service.auth.admin.updateUserById(authUserId, {
    app_metadata: {
      ...prev,
      [PORTAL_PENDING_DEALER_ID]: dealerId,
      [PORTAL_PENDING_STAFF_ROLE]: staffRole,
    },
  });
}

export async function stampPortalPendingByEmail(
  service: ServiceClient,
  email: string,
  dealerId: string,
  staffRole: "manager" | "staff",
): Promise<void> {
  const norm = email.trim();
  const { data: rows } = await service.from("users").select("id").ilike("email", norm).limit(2);
  if (!rows?.length || rows.length > 1) return;
  await stampPortalPendingDealerInvite(service, rows[0].id, dealerId, staffRole);
}

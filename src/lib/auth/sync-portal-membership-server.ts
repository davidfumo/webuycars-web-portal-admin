import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { createServiceSupabaseClient } from "@/lib/supabase/admin";
import {
  PORTAL_PENDING_DEALER_ID,
  PORTAL_PENDING_STAFF_ROLE,
} from "@/lib/auth/portal-pending-invite";

export type PortalPendingInvite = {
  dealerId: string;
  staffRole: "manager" | "staff";
};

export type SyncResult =
  | { ok: true; synced: false; reason: "no_pending" }
  | { ok: true; synced: true; dealerId: string; staffRole: "manager" | "staff" }
  | { ok: false; error: SyncErrorCode };

export type SyncErrorCode =
  | "service_role_missing"
  | "dealer_not_found"
  | "staff_insert_failed"
  | "staff_update_failed";

/**
 * Reads pending dealer membership from Auth `app_metadata` (set by admin/service flows).
 * Users cannot forge this — it is only writable via service role.
 */
export function readPortalPendingFromUser(user: User): PortalPendingInvite | null {
  const meta = (user.app_metadata ?? {}) as Record<string, unknown>;
  const rawDealer = meta[PORTAL_PENDING_DEALER_ID];
  const rawRole = meta[PORTAL_PENDING_STAFF_ROLE];
  if (typeof rawDealer !== "string" || rawDealer.length === 0) return null;
  const staffRole: "manager" | "staff" = rawRole === "staff" ? "staff" : "manager";
  return { dealerId: rawDealer, staffRole };
}

/**
 * Idempotently applies the pending dealer membership stored in Auth metadata.
 * Safe to call on every authenticated server render — does nothing when no pending.
 */
export async function syncPortalMembershipForUser(user: User): Promise<SyncResult> {
  const pending = readPortalPendingFromUser(user);
  if (!pending) return { ok: true, synced: false, reason: "no_pending" };

  let service: SupabaseClient<Database>;
  try {
    service = createServiceSupabaseClient();
  } catch {
    return { ok: false, error: "service_role_missing" };
  }

  const { data: dealer } = await service
    .from("dealers")
    .select("id, is_active")
    .eq("id", pending.dealerId)
    .maybeSingle();

  if (!dealer) {
    /** Stamp references a deleted dealer — drop the stamp so we never loop on it again. */
    await clearPendingStamp(service, user);
    return { ok: false, error: "dealer_not_found" };
  }

  const { data: existing } = await service
    .from("dealer_staff")
    .select("id, is_active, role")
    .eq("dealer_id", pending.dealerId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    if (!existing.is_active || existing.role !== pending.staffRole) {
      const { error } = await service
        .from("dealer_staff")
        .update({ is_active: true, role: pending.staffRole })
        .eq("id", existing.id);
      if (error) return { ok: false, error: "staff_update_failed" };
    }
  } else {
    const { error } = await service.from("dealer_staff").insert({
      dealer_id: pending.dealerId,
      user_id: user.id,
      role: pending.staffRole,
      is_active: true,
      onboarding_required: pending.staffRole === "manager",
    });
    if (error) return { ok: false, error: "staff_insert_failed" };
  }

  const appRole = pending.staffRole === "manager" ? "dealer_manager" : "dealer_staff";
  await service.from("users").update({ role: appRole }).eq("id", user.id);

  await clearPendingStamp(service, user, appRole);

  return {
    ok: true,
    synced: true,
    dealerId: pending.dealerId,
    staffRole: pending.staffRole,
  };
}

async function clearPendingStamp(
  service: SupabaseClient<Database>,
  user: User,
  appRole?: "dealer_manager" | "dealer_staff",
): Promise<void> {
  const prevApp = { ...(user.app_metadata ?? {}) } as Record<string, unknown>;
  delete prevApp[PORTAL_PENDING_DEALER_ID];
  delete prevApp[PORTAL_PENDING_STAFF_ROLE];

  const prevUserMeta = { ...(user.user_metadata ?? {}) } as Record<string, unknown>;
  await service.auth.admin.updateUserById(user.id, {
    app_metadata: prevApp,
    user_metadata: appRole ? { ...prevUserMeta, role: appRole } : prevUserMeta,
  });
}

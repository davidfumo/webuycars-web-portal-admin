import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";
import {
  readPortalPendingFromUser,
  syncPortalMembershipForUser,
} from "@/lib/auth/sync-portal-membership-server";

type UserRow = Database["public"]["Tables"]["users"]["Row"];
type StaffRow = Database["public"]["Tables"]["dealer_staff"]["Row"];

export type PortalSurface = "admin" | "dealer" | "none";

export type PortalRole =
  | "system_admin"
  | "dealer_manager"
  | "dealer_staff"
  | null;

export type PortalContext =
  | {
      userId: string;
      email: string | null;
      appUser: UserRow;
      surface: "admin";
      portalRole: "system_admin";
      dealerId: null;
      staff: null;
    }
  | {
      userId: string;
      email: string | null;
      appUser: UserRow;
      surface: "dealer";
      portalRole: "dealer_manager" | "dealer_staff";
      dealerId: string;
      staff: StaffRow;
    }
  | {
      userId: string;
      email: string | null;
      appUser: UserRow;
      surface: "none";
      portalRole: null;
      dealerId: null;
      staff: null;
    };

export async function getPortalContext(): Promise<PortalContext | null> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  /**
   * Auto-heal: invited users always have `portal_pending_dealer_id` stamped on Auth
   * `app_metadata`. If a previous DB step failed or the row was lost, this one call
   * restores `dealer_staff` + `public.users.role` so portal access never appears
   * orphaned. Safe to run on every render — idempotent and noop when no pending.
   */
  if (readPortalPendingFromUser(user)) {
    await syncPortalMembershipForUser(user);
  }

  const { data: appUser, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !appUser) return null;

  const email = user.email ?? appUser.email ?? null;

  if (appUser.role === "admin") {
    return {
      userId: user.id,
      email,
      appUser,
      surface: "admin",
      portalRole: "system_admin",
      dealerId: null,
      staff: null,
    };
  }

  const { data: staffRows } = await supabase
    .from("dealer_staff")
    .select("*")
    .eq("user_id", user.id)
    .eq("is_active", true);

  if (!staffRows?.length) {
    return {
      userId: user.id,
      email,
      appUser,
      surface: "none",
      portalRole: null,
      dealerId: null,
      staff: null,
    };
  }

  /** Prefer manager seat, stable order — `.limit(1)` alone could pick a suspended dealer first. */
  const candidates = [...staffRows].sort((a, b) => {
    if (a.role === "manager" && b.role !== "manager") return -1;
    if (b.role === "manager" && a.role !== "manager") return 1;
    return a.dealer_id.localeCompare(b.dealer_id);
  });

  let staff: StaffRow | null = null;
  for (const candidate of candidates) {
    const { data: dealerRow } = await supabase
      .from("dealers")
      .select("is_active")
      .eq("id", candidate.dealer_id)
      .maybeSingle();

    if (dealerRow?.is_active) {
      staff = candidate;
      break;
    }
  }

  if (!staff) {
    return {
      userId: user.id,
      email,
      appUser,
      surface: "none",
      portalRole: null,
      dealerId: null,
      staff: null,
    };
  }

  const portalRole: "dealer_manager" | "dealer_staff" =
    staff.role === "manager" ? "dealer_manager" : "dealer_staff";

  return {
    userId: user.id,
    email,
    appUser,
    surface: "dealer",
    portalRole,
    dealerId: staff.dealer_id,
    staff,
  };
}

export function dealerNeedsOnboarding(staff: StaffRow | null | undefined) {
  if (!staff) return false;
  if (staff.role !== "manager") return false;
  return Boolean(staff.onboarding_required) && !staff.onboarding_completed_at;
}

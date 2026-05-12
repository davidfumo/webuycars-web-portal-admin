import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceSupabaseClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/database.types";
import {
  readPortalPendingFromUser,
  syncPortalMembershipForUser,
} from "@/lib/auth/sync-portal-membership-server";

type UserRow = Database["public"]["Tables"]["users"]["Row"];
type StaffRow = Database["public"]["Tables"]["dealer_staff"]["Row"];
type DealerRow = Database["public"]["Tables"]["dealers"]["Row"];

export type PortalSurface = "admin" | "dealer" | "none";

export type PortalRole =
  | "system_admin"
  | "dealer_manager"
  | "dealer_staff"
  | null;

/**
 * One dealer context — the active one when the user has a single dealer,
 * or the one they last selected / the first manager seat they have.
 */
export type DealerContext = {
  staff: StaffRow;
  dealer: DealerRow;
  portalRole: "dealer_manager" | "dealer_staff";
};

export type PortalContext =
  | {
      userId: string;
      email: string | null;
      appUser: UserRow;
      surface: "admin";
      portalRole: "system_admin";
      dealerId: null;
      staff: null;
      allDealers: [];
    }
  | {
      userId: string;
      email: string | null;
      appUser: UserRow;
      surface: "dealer";
      portalRole: "dealer_manager" | "dealer_staff";
      dealerId: string;
      staff: StaffRow;
      /** All active dealer memberships — lets UI render a dealer switcher. */
      allDealers: DealerContext[];
    }
  | {
      userId: string;
      email: string | null;
      appUser: UserRow;
      surface: "none";
      portalRole: null;
      dealerId: null;
      staff: null;
      allDealers: [];
    };

export async function getPortalContext(): Promise<PortalContext | null> {
  /**
   * Step 1 — Verify identity.
   * Always use the anon (cookie-backed) client for this; it talks to the Supabase
   * Auth server and validates the JWT so we know the caller is genuinely this user.
   */
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  /**
   * Step 2 — Auto-heal pending invite.
   * If admin/service stamped `portal_pending_dealer_id` on app_metadata while
   * sending the invite, apply it now. Safe no-op when nothing is pending.
   */
  if (readPortalPendingFromUser(user)) {
    await syncPortalMembershipForUser(user);
  }

  /**
   * Step 3 — Read DB state with service role.
   * The anon client is subject to RLS which depends on `auth.uid()` being correctly
   * propagated through the SSR cookie → PostgREST pipeline. This can silently fail
   * for existing accounts, on first-login sessions, or when cookies haven't been
   * fully flushed before the page re-renders. Using service role here is safe because
   * the user's identity was already verified in Step 1.
   */
  let service;
  try {
    service = createServiceSupabaseClient();
  } catch {
    // Service role not configured — fall back to anon client (dev/local environments)
    service = supabase;
  }

  const { data: appUser } = await service
    .from("users")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (!appUser) {
    /**
     * No public.users row — the handle_new_user trigger must have missed this account
     * (e.g. account predates the trigger, or the trigger failed). Create the row now.
     */
    const role =
      (user.user_metadata?.role as string | undefined) ?? "buyer";
    const safeRole = [
      "buyer", "seller", "private_seller", "dealer",
      "dealer_manager", "dealer_staff", "admin",
    ].includes(role)
      ? (role as UserRow["role"])
      : ("buyer" as const);

    const { data: newUser } = await service
      .from("users")
      .insert({ id: user.id, email: user.email ?? null, role: safeRole })
      .select("*")
      .single();

    if (!newUser) return null;

    return {
      userId: user.id,
      email: user.email ?? null,
      appUser: newUser,
      surface: "none",
      portalRole: null,
      dealerId: null,
      staff: null,
      allDealers: [],
    };
  }

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
      allDealers: [],
    };
  }

  /**
   * Step 4 — Fetch all active dealer memberships (service role, no RLS).
   * Multi-dealer support: a user can have one staff row per dealer.
   * This is how dealer groups/chains work — shared employees appear in multiple dealers.
   */
  const { data: staffRows } = await service
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
      allDealers: [],
    };
  }

  // Fetch all dealers referenced by these staff rows in one query
  const dealerIds = staffRows.map((s) => s.dealer_id);
  const { data: dealers } = await service
    .from("dealers")
    .select("*")
    .in("id", dealerIds);

  const dealerMap = new Map((dealers ?? []).map((d) => [d.id, d]));

  /**
   * Build all active dealer contexts.
   * A dealer is only usable if it is active (not suspended/blocked).
   * Sort: manager seats first, then by dealer_id for stable ordering.
   */
  const allDealers: DealerContext[] = staffRows
    .filter((s) => {
      const d = dealerMap.get(s.dealer_id);
      return d?.is_active === true;
    })
    .sort((a, b) => {
      if (a.role === "manager" && b.role !== "manager") return -1;
      if (b.role === "manager" && a.role !== "manager") return 1;
      return a.dealer_id.localeCompare(b.dealer_id);
    })
    .map((s) => ({
      staff: s,
      dealer: dealerMap.get(s.dealer_id)!,
      portalRole: (s.role === "manager" ? "dealer_manager" : "dealer_staff") as
        | "dealer_manager"
        | "dealer_staff",
    }));

  if (!allDealers.length) {
    return {
      userId: user.id,
      email,
      appUser,
      surface: "none",
      portalRole: null,
      dealerId: null,
      staff: null,
      allDealers: [],
    };
  }

  /**
   * Pick the primary dealer context.
   * Priority: manager seat > first by dealer_id.
   * TODO: honour a `portal_dealer_id` cookie when the user has multiple dealers.
   */
  const primary = allDealers[0];

  return {
    userId: user.id,
    email,
    appUser,
    surface: "dealer",
    portalRole: primary.portalRole,
    dealerId: primary.staff.dealer_id,
    staff: primary.staff,
    allDealers,
  };
}

export function dealerNeedsOnboarding(staff: StaffRow | null | undefined) {
  if (!staff) return false;
  if (staff.role !== "manager") return false;
  return Boolean(staff.onboarding_required) && !staff.onboarding_completed_at;
}

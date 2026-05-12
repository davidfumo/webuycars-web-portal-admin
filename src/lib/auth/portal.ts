import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

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
    .eq("is_active", true)
    .limit(1);

  const staff = staffRows?.[0];
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

  const { data: dealerRow } = await supabase
    .from("dealers")
    .select("is_active")
    .eq("id", staff.dealer_id)
    .maybeSingle();

  if (!dealerRow?.is_active) {
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

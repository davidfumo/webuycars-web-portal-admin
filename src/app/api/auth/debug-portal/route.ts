import { NextResponse } from "next/server";
import { createRouteHandlerSupabaseClient } from "@/lib/supabase/route-handler";
import { createServiceSupabaseClient } from "@/lib/supabase/admin";
import {
  PORTAL_PENDING_DEALER_ID,
  PORTAL_PENDING_STAFF_ROLE,
} from "@/lib/auth/portal-pending-invite";

/**
 * GET /api/auth/debug-portal
 * Returns a full diagnostic snapshot of the signed-in user's portal state.
 * Useful for investigating "no portal access" issues without querying the DB manually.
 *
 * Only returns data for the currently authenticated user — never leaks other users' data.
 * Remove or gate behind `role === "admin"` before going to production if desired.
 */
export async function GET() {
  try {
    const supabase = await createRouteHandlerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }

    let service;
    try {
      service = createServiceSupabaseClient();
    } catch {
      return NextResponse.json({ error: "service_role_missing" }, { status: 500 });
    }

    // Fresh auth user (includes app_metadata)
    const { data: authUserRes } = await service.auth.admin.getUserById(user.id);
    const authUser = authUserRes?.user;

    // public.users row
    const { data: appUser, error: appUserErr } = await service
      .from("users")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    // All dealer_staff rows (any state)
    const { data: allStaff } = await service
      .from("dealer_staff")
      .select("*")
      .eq("user_id", user.id);

    // Dealers for those rows
    const dealerIds = (allStaff ?? []).map((s) => s.dealer_id);
    const { data: dealers } =
      dealerIds.length > 0
        ? await service.from("dealers").select("id,business_name,is_active").in("id", dealerIds)
        : { data: [] };

    const appMeta = (authUser?.app_metadata ?? {}) as Record<string, unknown>;

    return NextResponse.json({
      userId: user.id,
      email: user.email,
      pendingDealerId: appMeta[PORTAL_PENDING_DEALER_ID] ?? null,
      pendingStaffRole: appMeta[PORTAL_PENDING_STAFF_ROLE] ?? null,
      appUserExists: !!appUser,
      appUserErr: appUserErr?.message ?? null,
      appUserRole: appUser?.role ?? null,
      staffRows: (allStaff ?? []).map((s) => ({
        id: s.id,
        dealer_id: s.dealer_id,
        role: s.role,
        is_active: s.is_active,
        onboarding_required: s.onboarding_required,
      })),
      dealers: (dealers ?? []).map((d) => ({
        id: d.id,
        business_name: d.business_name,
        is_active: d.is_active,
      })),
    });
  } catch {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

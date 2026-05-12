import { NextResponse } from "next/server";
import { z } from "zod";
import { createRouteHandlerSupabaseClient } from "@/lib/supabase/route-handler";
import { createServiceSupabaseClient } from "@/lib/supabase/admin";
import {
  PORTAL_PENDING_DEALER_ID,
  PORTAL_PENDING_STAFF_ROLE,
} from "@/lib/auth/portal-pending-invite";

/**
 * Applies pending dealer membership from Auth app_metadata (set by admin/service flows).
 * Idempotent: safe to call after invite password completion or when the portal still shows "none".
 */
export async function POST() {
  try {
    const supabase = await createRouteHandlerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    let service;
    try {
      service = createServiceSupabaseClient();
    } catch {
      return NextResponse.json({ error: "service_role_missing" }, { status: 500 });
    }

    const { data: authRes, error: authErr } = await service.auth.admin.getUserById(user.id);
    if (authErr || !authRes?.user) {
      return NextResponse.json({ error: "auth_lookup_failed" }, { status: 400 });
    }

    const meta = (authRes.user.app_metadata ?? {}) as Record<string, unknown>;
    const rawDealer = meta[PORTAL_PENDING_DEALER_ID];
    const rawRole = meta[PORTAL_PENDING_STAFF_ROLE];

    if (typeof rawDealer !== "string" || !z.string().uuid().safeParse(rawDealer).success) {
      return NextResponse.json({ synced: false, reason: "no_pending" });
    }

    const staffRole = rawRole === "staff" || rawRole === "manager" ? rawRole : "manager";

    const { data: dealer } = await service.from("dealers").select("id").eq("id", rawDealer).maybeSingle();
    if (!dealer) {
      return NextResponse.json({ error: "dealer_not_found" }, { status: 400 });
    }

    const { data: existing } = await service
      .from("dealer_staff")
      .select("id")
      .eq("dealer_id", rawDealer)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing?.id) {
      const { error: upErr } = await service
        .from("dealer_staff")
        .update({
          role: staffRole,
          is_active: true,
        })
        .eq("id", existing.id);
      if (upErr) {
        return NextResponse.json({ error: "staff_update_failed" }, { status: 400 });
      }
    } else {
      const { error: insErr } = await service.from("dealer_staff").insert({
        dealer_id: rawDealer,
        user_id: user.id,
        role: staffRole,
        is_active: true,
        onboarding_required: staffRole === "manager",
      });
      if (insErr) {
        return NextResponse.json({ error: "staff_insert_failed" }, { status: 400 });
      }
    }

    const appRole = staffRole === "manager" ? "dealer_manager" : "dealer_staff";
    await service.from("users").update({ role: appRole }).eq("id", user.id);

    const prevMeta = { ...(authRes.user.app_metadata ?? {}) } as Record<string, unknown>;
    delete prevMeta[PORTAL_PENDING_DEALER_ID];
    delete prevMeta[PORTAL_PENDING_STAFF_ROLE];

    const prevUserMeta = { ...(authRes.user.user_metadata ?? {}) } as Record<string, unknown>;
    await service.auth.admin.updateUserById(user.id, {
      app_metadata: prevMeta,
      user_metadata: { ...prevUserMeta, role: appRole },
    });

    return NextResponse.json({ synced: true, dealerId: rawDealer, staffRole });
  } catch {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

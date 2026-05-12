import { NextResponse } from "next/server";
import { z } from "zod";
import { createRouteHandlerSupabaseClient } from "@/lib/supabase/route-handler";
import { createServiceSupabaseClient } from "@/lib/supabase/admin";
import { portalInviteCallbackUrl } from "@/lib/auth/portal-invite-callback-url";
import { sendDealerManagerAccess } from "@/lib/admin/send-dealer-manager-access";

const bodySchema = z.object({
  portalLocale: z.enum(["pt", "en"]).optional(),
});

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createRouteHandlerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const { data: appUser } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (!appUser || appUser.role !== "admin") {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    let service;
    try {
      service = createServiceSupabaseClient();
    } catch {
      return NextResponse.json({ error: "service_role_missing" }, { status: 500 });
    }

    const { id: dealerId } = await ctx.params;
    if (!z.string().uuid().safeParse(dealerId).success) {
      return NextResponse.json({ error: "invalid_id" }, { status: 400 });
    }

    const json = await request.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "invalid_body" }, { status: 400 });
    }

    const { data: staff } = await service
      .from("dealer_staff")
      .select("user_id")
      .eq("dealer_id", dealerId)
      .eq("role", "manager")
      .eq("is_active", true)
      .maybeSingle();

    if (!staff?.user_id) {
      return NextResponse.json({ error: "manager_not_found" }, { status: 404 });
    }

    const { data: userRow } = await service
      .from("users")
      .select("email")
      .eq("id", staff.user_id)
      .maybeSingle();

    const managerEmail = userRow?.email?.trim();
    if (!managerEmail) {
      return NextResponse.json({ error: "manager_email_missing" }, { status: 400 });
    }

    const origin = new URL(request.url).origin;
    const loc = parsed.data.portalLocale ?? "pt";
    const redirectTo = portalInviteCallbackUrl(origin, loc);

    const access = await sendDealerManagerAccess(service, managerEmail, redirectTo, { dealerId });
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: 400 });
    }

    return NextResponse.json({
      managerEmail,
      inviteEmailSent: access.inviteEmailSent,
      setupLink: access.setupLink,
      linkKind: access.linkKind,
    });
  } catch {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

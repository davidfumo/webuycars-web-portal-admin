import { NextResponse } from "next/server";
import { z } from "zod";
import { createRouteHandlerSupabaseClient } from "@/lib/supabase/route-handler";
import { createServiceSupabaseClient } from "@/lib/supabase/admin";
import { portalInviteCallbackUrl } from "@/lib/auth/portal-invite-callback-url";
import { inviteUserWithEmailFallback } from "@/lib/auth/invite-helpers";

const bodySchema = z.object({
  email: z.string().email(),
  portalLocale: z.enum(["pt", "en"]).optional(),
});

export async function POST(request: Request) {
  try {
    const supabase = await createRouteHandlerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const { data: managerRow } = await supabase
      .from("dealer_staff")
      .select("dealer_id")
      .eq("user_id", user.id)
      .eq("role", "manager")
      .eq("is_active", true)
      .maybeSingle();

    if (!managerRow?.dealer_id) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const { data: dealer } = await supabase
      .from("dealers")
      .select("is_active")
      .eq("id", managerRow.dealer_id)
      .maybeSingle();

    if (!dealer?.is_active) {
      return NextResponse.json({ error: "dealer_inactive" }, { status: 403 });
    }

    let service;
    try {
      service = createServiceSupabaseClient();
    } catch {
      return NextResponse.json({ error: "service_role_missing" }, { status: 500 });
    }

    const json = await request.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "invalid_body" }, { status: 400 });
    }

    const origin = new URL(request.url).origin;
    const loc = parsed.data.portalLocale ?? "pt";
    const redirectTo = portalInviteCallbackUrl(origin, loc);

    const invited = await inviteUserWithEmailFallback(
      service,
      parsed.data.email,
      redirectTo,
      { role: "dealer_staff" },
      { dealerId: managerRow.dealer_id, staffRole: "staff" },
    );

    if (!invited.ok) {
      if (invited.error === "email_exists") {
        return NextResponse.json({ error: "email_exists" }, { status: 400 });
      }
      return NextResponse.json({ error: "invite_failed" }, { status: 400 });
    }

    const newUserId = invited.userId;

    const { error: staffErr } = await service.from("dealer_staff").insert({
      dealer_id: managerRow.dealer_id,
      user_id: newUserId,
      role: "staff",
      is_active: true,
      onboarding_required: false,
    });

    if (staffErr) {
      await service.auth.admin.deleteUser(newUserId);
      return NextResponse.json({ error: "staff_insert_failed" }, { status: 400 });
    }

    return NextResponse.json({
      userId: newUserId,
      inviteEmailSent: invited.emailSent,
      setupLink: invited.setupLink,
    });
  } catch {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { createRouteHandlerSupabaseClient } from "@/lib/supabase/route-handler";
import { createServiceSupabaseClient } from "@/lib/supabase/admin";
import { portalInviteCallbackUrl } from "@/lib/auth/portal-invite-callback-url";
import { stampPortalPendingDealerInvite } from "@/lib/auth/portal-pending-invite";
import { sendDealerManagerAccess } from "@/lib/admin/send-dealer-manager-access";

const bodySchema = z.object({
  email: z.string().email(),
  portalLocale: z.enum(["pt", "en"]).optional(),
  /** When true (default), send invite / recovery / magic link after linking. */
  sendAccess: z.boolean().optional(),
});

const managerMeta = { role: "dealer_manager" } as const;

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

    const json = await request.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "invalid_body" }, { status: 400 });
    }

    const emailNorm = parsed.data.email.trim();
    const sendAccess = parsed.data.sendAccess !== false;

    const { data: dealer } = await service.from("dealers").select("id,is_active").eq("id", dealerId).maybeSingle();
    if (!dealer) {
      return NextResponse.json({ error: "dealer_not_found" }, { status: 404 });
    }
    if (!dealer.is_active) {
      return NextResponse.json({ error: "dealer_inactive" }, { status: 400 });
    }

    const { data: userRows, error: userLookupErr } = await service
      .from("users")
      .select("id,email,role")
      .ilike("email", emailNorm)
      .limit(2);

    if (userLookupErr) {
      return NextResponse.json({ error: "user_lookup_failed" }, { status: 400 });
    }

    if (!userRows?.length) {
      return NextResponse.json({ error: "user_not_found" }, { status: 404 });
    }

    if (userRows.length >= 2) {
      return NextResponse.json({ error: "ambiguous_email" }, { status: 400 });
    }

    const target = userRows[0];

    if (target.role === "admin") {
      return NextResponse.json({ error: "cannot_link_admin" }, { status: 400 });
    }

    const { data: existingManager } = await service
      .from("dealer_staff")
      .select("user_id")
      .eq("dealer_id", dealerId)
      .eq("role", "manager")
      .eq("is_active", true)
      .maybeSingle();

    if (existingManager?.user_id === target.id) {
      if (!sendAccess) {
        await stampPortalPendingDealerInvite(service, target.id, dealerId, "manager");
        return NextResponse.json({
          linked: true,
          alreadyManager: true,
          userId: target.id,
        });
      }
    } else {
      await service
        .from("dealer_staff")
        .update({ is_active: false })
        .eq("dealer_id", dealerId)
        .eq("role", "manager")
        .neq("user_id", target.id);

      const { data: ownRows } = await service
        .from("dealer_staff")
        .select("id")
        .eq("dealer_id", dealerId)
        .eq("user_id", target.id);

      const keepId = ownRows?.[0]?.id;

      if (keepId) {
        const { error: upErr } = await service
          .from("dealer_staff")
          .update({
            role: "manager",
            is_active: true,
            onboarding_required: true,
            onboarding_completed_at: null,
          })
          .eq("id", keepId);

        if (upErr) {
          return NextResponse.json({ error: "staff_update_failed" }, { status: 400 });
        }

        if (ownRows && ownRows.length > 1) {
          await service
            .from("dealer_staff")
            .delete()
            .eq("dealer_id", dealerId)
            .eq("user_id", target.id)
            .neq("id", keepId);
        }
      } else {
        const { error: insErr } = await service.from("dealer_staff").insert({
          dealer_id: dealerId,
          user_id: target.id,
          role: "manager",
          is_active: true,
          onboarding_required: true,
        });
        if (insErr) {
          return NextResponse.json({ error: "staff_insert_failed" }, { status: 400 });
        }
      }

      if (target.role !== "dealer_manager") {
        await service.from("users").update({ role: "dealer_manager" }).eq("id", target.id);
      }

      await service.auth.admin.updateUserById(target.id, {
        user_metadata: { ...managerMeta },
      });
    }

    const { data: verifyStaff } = await service
      .from("dealer_staff")
      .select("id")
      .eq("dealer_id", dealerId)
      .eq("user_id", target.id)
      .eq("role", "manager")
      .eq("is_active", true)
      .maybeSingle();

    if (!verifyStaff) {
      return NextResponse.json({ error: "staff_verification_failed" }, { status: 500 });
    }

    await stampPortalPendingDealerInvite(service, target.id, dealerId, "manager");

    if (!sendAccess) {
      return NextResponse.json({
        linked: true,
        alreadyManager: Boolean(existingManager?.user_id === target.id),
        userId: target.id,
      });
    }

    const origin = new URL(request.url).origin;
    const loc = parsed.data.portalLocale ?? "pt";
    const redirectTo = portalInviteCallbackUrl(origin, loc);

    const managerEmail = target.email?.trim();
    if (!managerEmail) {
      return NextResponse.json({ error: "manager_email_missing" }, { status: 400 });
    }

    const access = await sendDealerManagerAccess(service, managerEmail, redirectTo, { dealerId });
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: 400 });
    }

    return NextResponse.json({
      linked: true,
      userId: target.id,
      inviteEmailSent: access.inviteEmailSent,
      setupLink: access.setupLink,
      linkKind: access.linkKind,
    });
  } catch {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

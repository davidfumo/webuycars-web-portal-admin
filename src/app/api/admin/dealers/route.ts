import { NextResponse } from "next/server";
import { z } from "zod";
import { createRouteHandlerSupabaseClient } from "@/lib/supabase/route-handler";
import { createServiceSupabaseClient } from "@/lib/supabase/admin";
import { slugify } from "@/lib/slugify";
import { portalInviteCallbackUrl } from "@/lib/auth/portal-invite-callback-url";

const createDealerSchema = z.object({
  businessName: z.string().min(2),
  provinceId: z.string().uuid(),
  contactEmail: z.string().email(),
  contactPhone: z.string().min(6),
  address: z.string().optional(),
  packageId: z.string().uuid(),
  managerEmail: z.string().email(),
  logoUrl: z.string().url().optional().nullable(),
  /** Locale segment for the manager’s invite redirect (e.g. `/en/auth/complete-invite`). */
  portalLocale: z.enum(["pt", "en"]).optional(),
});

const managerMeta = { role: "dealer_manager" } as const;

function isEmailAlreadyRegisteredError(err: { message?: string; code?: string } | null): boolean {
  if (!err) return false;
  const m = (err.message ?? "").toLowerCase();
  const c = err.code ?? "";
  return (
    c === "email_exists" ||
    m.includes("already been registered") ||
    m.includes("already registered") ||
    m.includes("user already exists") ||
    m.includes("duplicate")
  );
}

export async function POST(request: Request) {
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
      return NextResponse.json(
        { error: "service_role_missing" },
        { status: 500 },
      );
    }

    const json = await request.json();
    const parsed = createDealerSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "invalid_body", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const body = parsed.data;

    const origin = new URL(request.url).origin;
    const loc = body.portalLocale ?? "pt";
    const redirectTo = portalInviteCallbackUrl(origin, loc);

    const invited = await service.auth.admin.inviteUserByEmail(body.managerEmail, {
      data: { ...managerMeta },
      redirectTo,
    });

    let managerId: string;
    let inviteEmailSent = true;
    let managerSetupLink: string | null = null;

    if (!invited.error && invited.data.user) {
      managerId = invited.data.user.id;
    } else if (isEmailAlreadyRegisteredError(invited.error)) {
      return NextResponse.json({ error: "manager_email_exists" }, { status: 400 });
    } else {
      const generated = await service.auth.admin.generateLink({
        type: "invite",
        email: body.managerEmail,
        options: {
          data: { ...managerMeta },
          redirectTo,
        },
      });

      if (generated.error || !generated.data.user || !generated.data.properties) {
        return NextResponse.json({ error: "auth_user_create_failed" }, { status: 400 });
      }

      managerId = generated.data.user.id;
      managerSetupLink = generated.data.properties.action_link;
      inviteEmailSent = false;
    }

    await service.auth.admin.updateUserById(managerId, {
      user_metadata: { ...managerMeta },
    });

    const baseSlug = slugify(body.businessName);
    const slug = `${baseSlug}-${managerId.slice(0, 8)}`;

    const { data: dealer, error: dealerError } = await service
      .from("dealers")
      .insert({
        business_name: body.businessName,
        province_id: body.provinceId,
        contact_email: body.contactEmail,
        contact_phone: body.contactPhone,
        address: body.address ?? null,
        slug,
        logo_url: body.logoUrl ?? null,
        is_active: true,
      })
      .select("id")
      .single();

    if (dealerError || !dealer) {
      await service.auth.admin.deleteUser(managerId);
      return NextResponse.json({ error: "dealer_insert_failed" }, { status: 400 });
    }

    const { data: subscription, error: subError } = await service
      .from("dealer_subscriptions")
      .insert({
        dealer_id: dealer.id,
        package_id: body.packageId,
        status: "pending_payment",
      })
      .select("id")
      .single();

    if (subError || !subscription) {
      await service.from("dealers").delete().eq("id", dealer.id);
      await service.auth.admin.deleteUser(managerId);
      return NextResponse.json({ error: "subscription_insert_failed" }, { status: 400 });
    }

    const { error: staffError } = await service.from("dealer_staff").insert({
      dealer_id: dealer.id,
      user_id: managerId,
      role: "manager",
      is_active: true,
      onboarding_required: true,
    });

    if (staffError) {
      await service.from("dealer_subscriptions").delete().eq("id", subscription.id);
      await service.from("dealers").delete().eq("id", dealer.id);
      await service.auth.admin.deleteUser(managerId);
      return NextResponse.json({ error: "staff_insert_failed" }, { status: 400 });
    }

    const { data: pkgRow, error: pkgErr } = await service
      .from("dealer_packages")
      .select("price")
      .eq("id", body.packageId)
      .maybeSingle();

    if (pkgErr || pkgRow == null) {
      await service.from("dealer_staff").delete().eq("dealer_id", dealer.id);
      await service.from("dealer_subscriptions").delete().eq("id", subscription.id);
      await service.from("dealers").delete().eq("id", dealer.id);
      await service.auth.admin.deleteUser(managerId);
      return NextResponse.json({ error: "package_lookup_failed" }, { status: 400 });
    }

    const { error: payErr } = await service.from("payments").insert({
      user_id: managerId,
      dealer_id: dealer.id,
      subscription_id: subscription.id,
      amount: pkgRow.price,
      currency: "MZN",
      payment_status: "pending",
      payment_type: "subscription",
      payment_method: null,
    });

    if (payErr) {
      await service.from("dealer_staff").delete().eq("dealer_id", dealer.id);
      await service.from("dealer_subscriptions").delete().eq("id", subscription.id);
      await service.from("dealers").delete().eq("id", dealer.id);
      await service.auth.admin.deleteUser(managerId);
      return NextResponse.json({ error: "payment_insert_failed" }, { status: 400 });
    }

    return NextResponse.json({
      dealerId: dealer.id,
      subscriptionId: subscription.id,
      managerUserId: managerId,
      inviteEmailSent,
      managerSetupLink,
    });
  } catch {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

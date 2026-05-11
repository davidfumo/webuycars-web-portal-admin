import { NextResponse } from "next/server";
import { z } from "zod";
import { createRouteHandlerSupabaseClient } from "@/lib/supabase/route-handler";
import { createServiceSupabaseClient } from "@/lib/supabase/admin";
import { slugify } from "@/lib/slugify";

const createDealerSchema = z.object({
  businessName: z.string().min(2),
  provinceId: z.string().uuid(),
  contactEmail: z.string().email(),
  contactPhone: z.string().min(6),
  address: z.string().optional(),
  packageId: z.string().uuid(),
  managerEmail: z.string().email(),
  logoUrl: z.string().url().optional().nullable(),
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

    const tempPassword = `Wbc-${crypto.randomUUID()}`;

    const { data: createdUser, error: createError } =
      await service.auth.admin.createUser({
        email: body.managerEmail,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { role: "dealer_manager" },
      });

    if (createError || !createdUser.user) {
      return NextResponse.json(
        { error: "auth_user_create_failed", details: createError?.message },
        { status: 400 },
      );
    }

    const managerId = createdUser.user.id;

    await service.auth.admin.updateUserById(managerId, {
      user_metadata: { role: "dealer_manager" },
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
      return NextResponse.json(
        { error: "dealer_insert_failed", details: dealerError?.message },
        { status: 400 },
      );
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
      return NextResponse.json(
        { error: "subscription_insert_failed", details: subError?.message },
        { status: 400 },
      );
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
      return NextResponse.json(
        { error: "staff_insert_failed", details: staffError.message },
        { status: 400 },
      );
    }

    return NextResponse.json({
      dealerId: dealer.id,
      subscriptionId: subscription.id,
      managerUserId: managerId,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "unknown_error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

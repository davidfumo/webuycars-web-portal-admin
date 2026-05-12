import { NextResponse } from "next/server";
import { z } from "zod";
import type { Database } from "@/lib/database.types";
import { createRouteHandlerSupabaseClient } from "@/lib/supabase/route-handler";
import { createServiceSupabaseClient } from "@/lib/supabase/admin";

type DealerUpdate = Database["public"]["Tables"]["dealers"]["Update"];

const patchDealerSchema = z
  .object({
    businessName: z.string().min(2).optional(),
    provinceId: z.string().uuid().optional(),
    contactEmail: z.string().email().optional(),
    contactPhone: z.string().min(6).optional(),
    address: z.string().nullable().optional(),
    isActive: z.boolean().optional(),
    logoUrl: z.string().url().nullable().optional(),
  })
  .strict();

const deleteBodySchema = z.object({
  confirmDealerId: z.string().uuid(),
});

async function requireAdminService() {
  const supabase = await createRouteHandlerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  }
  const { data: appUser } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (!appUser || appUser.role !== "admin") {
    return { error: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  }
  let service;
  try {
    service = createServiceSupabaseClient();
  } catch {
    return {
      error: NextResponse.json({ error: "service_role_missing" }, { status: 500 }),
    };
  }
  return { service };
}

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdminService();
    if ("error" in admin) return admin.error;
    const { service } = admin;
    const { id } = await ctx.params;

    if (!z.string().uuid().safeParse(id).success) {
      return NextResponse.json({ error: "invalid_id" }, { status: 400 });
    }

    const json = await request.json();
    const parsed = patchDealerSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "invalid_body", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const body = parsed.data;
    if (Object.keys(body).length === 0) {
      return NextResponse.json({ error: "empty_body" }, { status: 400 });
    }

    const patch: DealerUpdate = {};
    if (body.businessName !== undefined) patch.business_name = body.businessName;
    if (body.provinceId !== undefined) patch.province_id = body.provinceId;
    if (body.contactEmail !== undefined) patch.contact_email = body.contactEmail;
    if (body.contactPhone !== undefined) patch.contact_phone = body.contactPhone;
    if (body.address !== undefined) patch.address = body.address;
    if (body.isActive !== undefined) patch.is_active = body.isActive;
    if (body.logoUrl !== undefined) patch.logo_url = body.logoUrl;

    const { error } = await service.from("dealers").update(patch).eq("id", id);
    if (error) {
      return NextResponse.json({ error: "update_failed" }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function DELETE(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdminService();
    if ("error" in admin) return admin.error;
    const { service } = admin;
    const { id } = await ctx.params;

    if (!z.string().uuid().safeParse(id).success) {
      return NextResponse.json({ error: "invalid_id" }, { status: 400 });
    }

    const json = await request.json().catch(() => null);
    const parsed = deleteBodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "invalid_body" }, { status: 400 });
    }
    if (parsed.data.confirmDealerId !== id) {
      return NextResponse.json({ error: "confirm_mismatch" }, { status: 400 });
    }

    const { count, error: countErr } = await service
      .from("vehicle_listings")
      .select("id", { count: "exact", head: true })
      .eq("dealer_id", id);

    if (countErr) {
      return NextResponse.json({ error: "listings_check_failed" }, { status: 400 });
    }
    if ((count ?? 0) > 0) {
      return NextResponse.json(
        { error: "dealer_has_listings", count: count ?? 0 },
        { status: 409 },
      );
    }

    const { data: paymentRows } = await service.from("payments").select("id").eq("dealer_id", id);
    const paymentIds = (paymentRows ?? []).map((p) => p.id);
    if (paymentIds.length > 0) {
      await service.from("payment_logs").delete().in("payment_id", paymentIds);
    }
    await service.from("payments").delete().eq("dealer_id", id);
    await service.from("dealer_subscriptions").delete().eq("dealer_id", id);
    await service.from("dealer_staff").delete().eq("dealer_id", id);
    await service.from("dealer_pricing_rules").delete().eq("dealer_id", id);
    await service.from("dealer_listing_batches").delete().eq("dealer_id", id);

    const { error: delErr } = await service.from("dealers").delete().eq("id", id);
    if (delErr) {
      return NextResponse.json({ error: "delete_failed" }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

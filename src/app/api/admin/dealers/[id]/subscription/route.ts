import { NextResponse } from "next/server";
import { z } from "zod";
import { createRouteHandlerSupabaseClient } from "@/lib/supabase/route-handler";
import { createServiceSupabaseClient } from "@/lib/supabase/admin";

const patchSchema = z.object({
  packageId: z.string().uuid(),
});

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
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
    const parsed = patchSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "invalid_body" }, { status: 400 });
    }
    const { packageId } = parsed.data;

    const { data: sub, error: subErr } = await service
      .from("dealer_subscriptions")
      .select("id,status")
      .eq("dealer_id", dealerId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (subErr || !sub) {
      return NextResponse.json({ error: "subscription_not_found" }, { status: 404 });
    }
    if (sub.status !== "pending_payment") {
      return NextResponse.json({ error: "subscription_not_pending_payment" }, { status: 400 });
    }

    const { data: pkg, error: pkgErr } = await service
      .from("dealer_packages")
      .select("id,price")
      .eq("id", packageId)
      .maybeSingle();

    if (pkgErr || !pkg) {
      return NextResponse.json({ error: "package_not_found" }, { status: 400 });
    }

    const { error: upSubErr } = await service
      .from("dealer_subscriptions")
      .update({ package_id: packageId })
      .eq("id", sub.id);

    if (upSubErr) {
      return NextResponse.json({ error: "subscription_update_failed" }, { status: 400 });
    }

    const { data: pendingPay } = await service
      .from("payments")
      .select("id")
      .eq("subscription_id", sub.id)
      .eq("payment_type", "subscription")
      .eq("payment_status", "pending")
      .maybeSingle();

    if (pendingPay?.id) {
      await service
        .from("payments")
        .update({ amount: pkg.price })
        .eq("id", pendingPay.id);
    } else {
      const { data: mgr } = await service
        .from("dealer_staff")
        .select("user_id")
        .eq("dealer_id", dealerId)
        .eq("role", "manager")
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();

      if (!mgr?.user_id) {
        return NextResponse.json({ error: "manager_not_found" }, { status: 400 });
      }

      await service.from("payments").insert({
        user_id: mgr.user_id,
        dealer_id: dealerId,
        subscription_id: sub.id,
        amount: pkg.price,
        currency: "MZN",
        payment_status: "pending",
        payment_type: "subscription",
        payment_method: null,
      });
    }

    return NextResponse.json({ ok: true, subscriptionId: sub.id, amount: pkg.price });
  } catch {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

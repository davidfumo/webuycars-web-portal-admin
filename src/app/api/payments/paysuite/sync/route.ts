import { NextResponse } from "next/server";
import { z } from "zod";
import { createRouteHandlerSupabaseClient } from "@/lib/supabase/route-handler";
import { createServiceSupabaseClient } from "@/lib/supabase/admin";
import { getPaysuiteEnv } from "@/lib/paysuite/env";
import { paysuiteGetPayment } from "@/lib/paysuite/client";
import { isPaysuitePaymentRecordPaid } from "@/lib/paysuite/payment-status";
import { applyPaysuiteSubscriptionPaid } from "@/lib/payments/apply-paysuite-subscription-paid";

const bodySchema = z.object({
  paymentId: z.string().uuid(),
});

/**
 * POST /api/payments/paysuite/sync
 * Re-reads PaySuite payment status and applies subscription activation when paid
 * (idempotent). Used after `return_url` redirect while waiting for webhooks.
 */
export async function POST(request: Request) {
  const paysuite = getPaysuiteEnv();
  if (!paysuite) {
    return NextResponse.json({ error: "paysuite_not_configured" }, { status: 503 });
  }

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

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const { data: pay } = await service
    .from("payments")
    .select("id, dealer_id, payment_status, payment_type, paysuite_payment_id")
    .eq("id", parsed.data.paymentId)
    .maybeSingle();

  if (!pay?.dealer_id || (pay.payment_type !== "subscription" && pay.payment_type !== "upgrade")) {
    return NextResponse.json({ error: "payment_not_found" }, { status: 404 });
  }

  const { data: staff } = await service
    .from("dealer_staff")
    .select("id")
    .eq("dealer_id", pay.dealer_id)
    .eq("user_id", user.id)
    .eq("role", "manager")
    .eq("is_active", true)
    .maybeSingle();

  if (!staff) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  if (pay.payment_status === "paid") {
    await applyPaysuiteSubscriptionPaid(
      service,
      pay.id,
      {
        id: typeof pay.paysuite_payment_id === "string" ? pay.paysuite_payment_id : "",
      } as Record<string, unknown>,
    );
    return NextResponse.json({ status: "paid", applied: false });
  }

  if (!pay.paysuite_payment_id) {
    return NextResponse.json({ error: "no_paysuite_session" }, { status: 400 });
  }

  let remote;
  try {
    remote = await paysuiteGetPayment(paysuite, pay.paysuite_payment_id);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "paysuite_error";
    return NextResponse.json({ error: "paysuite_fetch_failed", message: msg }, { status: 502 });
  }

  if (isPaysuitePaymentRecordPaid(remote)) {
    await applyPaysuiteSubscriptionPaid(service, pay.id, remote as unknown as Record<string, unknown>);
    return NextResponse.json({ status: "paid", applied: true });
  }

  return NextResponse.json({ status: remote.status, applied: false });
}

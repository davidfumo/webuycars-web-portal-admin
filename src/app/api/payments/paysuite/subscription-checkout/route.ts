import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { createRouteHandlerSupabaseClient } from "@/lib/supabase/route-handler";
import { createServiceSupabaseClient } from "@/lib/supabase/admin";
import { getPaysuiteEnv } from "@/lib/paysuite/env";
import { paysuiteCreatePayment, paysuiteGetPayment } from "@/lib/paysuite/client";
import { paysuiteReferenceForPayment } from "@/lib/paysuite/reference";
import { toPaysuiteMethod } from "@/lib/paysuite/map-method";
import { isPaysuitePaymentRecordPaid } from "@/lib/paysuite/payment-status";
import { applyPaysuiteSubscriptionPaid } from "@/lib/payments/apply-paysuite-subscription-paid";

const bodySchema = z.object({
  paymentId: z.string().uuid(),
  method: z.enum(["mpesa", "emola", "card"]),
  /** next-intl locale segment, e.g. `en` or `pt` */
  locale: z.string().min(2).max(5).optional(),
});

/**
 * POST /api/payments/paysuite/subscription-checkout
 * Authenticated dealer manager: creates a PaySuite payment request and returns `checkout_url`.
 * Mobile apps can call the same route with the user's Supabase session cookie or bearer token
 * if you forward the `Authorization` header to this Next.js deployment.
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

  const { paymentId, method, locale } = parsed.data;

  const { data: pay, error: payErr } = await service
    .from("payments")
    .select(
      "id, dealer_id, user_id, amount, currency, payment_status, payment_type, subscription_id, paysuite_payment_id, paysuite_reference",
    )
    .eq("id", paymentId)
    .maybeSingle();

  if (payErr || !pay?.dealer_id || !pay.subscription_id) {
    return NextResponse.json({ error: "payment_not_found" }, { status: 404 });
  }

  if (pay.payment_type !== "subscription" || pay.payment_status !== "pending") {
    return NextResponse.json({ error: "invalid_payment_state" }, { status: 400 });
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

  if (pay.paysuite_payment_id) {
    try {
      const remote = await paysuiteGetPayment(paysuite, pay.paysuite_payment_id);
      if (isPaysuitePaymentRecordPaid(remote)) {
        await applyPaysuiteSubscriptionPaid(service, pay.id, remote as unknown as Record<string, unknown>);
        return NextResponse.json({ alreadyPaid: true, status: "paid" });
      }
      if (remote.checkout_url) {
        return NextResponse.json({ checkoutUrl: remote.checkout_url, paysuitePaymentId: remote.id });
      }
    } catch {
      // fall through to create a fresh request if PaySuite no longer has the id
    }
  }

  const reference = pay.paysuite_reference ?? paysuiteReferenceForPayment(paymentId);

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  const origin = host ? `${proto}://${host}` : new URL(request.url).origin;
  const loc = locale ?? "pt";
  const returnUrl = `${origin}/${loc}/dealer/payment/return?paymentId=${encodeURIComponent(paymentId)}`;
  const callbackUrl = `${origin}/api/webhooks/paysuite`;

  let remote;
  try {
    remote = await paysuiteCreatePayment(paysuite, {
      amount: String(Number(pay.amount)),
      reference,
      description: `WeBuyCars subscription`,
      return_url: returnUrl,
      callback_url: callbackUrl,
      method: toPaysuiteMethod(method),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "paysuite_error";
    console.error("PaySuite create payment:", msg);
    return NextResponse.json({ error: "paysuite_rejected", message: msg }, { status: 502 });
  }

  if (!remote.checkout_url) {
    return NextResponse.json({ error: "no_checkout_url" }, { status: 502 });
  }

  await service
    .from("payments")
    .update({
      paysuite_payment_id: remote.id,
      paysuite_reference: reference,
      payment_method: method,
    })
    .eq("id", paymentId);

  return NextResponse.json({
    checkoutUrl: remote.checkout_url,
    paysuitePaymentId: remote.id,
  });
}

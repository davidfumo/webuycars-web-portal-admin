import { NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase/admin";
import { getPaysuiteEnv } from "@/lib/paysuite/env";
import { verifyPaysuiteWebhookSignature } from "@/lib/paysuite/verify-webhook";
import { applyPaysuiteSubscriptionPaid } from "@/lib/payments/apply-paysuite-subscription-paid";
import type { Database, Json } from "@/lib/database.types";

type WebhookEnvelope = {
  event?: string;
  data?: Record<string, unknown>;
  request_id?: string;
};

/**
 * POST /api/webhooks/paysuite
 * Configure this URL in the PaySuite merchant dashboard (Webhooks).
 * Verifies `X-Webhook-Signature` when `PAYSUITE_WEBHOOK_SECRET` is set.
 */
export async function POST(request: Request) {
  const raw = await request.text();
  const env = getPaysuiteEnv();
  if (!env?.webhookSecret) {
    console.error("PaySuite webhook: PAYSUITE_WEBHOOK_SECRET is not configured");
    return NextResponse.json({ ok: false }, { status: 503 });
  }

  const sig = request.headers.get("x-webhook-signature");
  if (!verifyPaysuiteWebhookSignature(raw, sig, env.webhookSecret)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let payload: WebhookEnvelope;
  try {
    payload = JSON.parse(raw) as WebhookEnvelope;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const event = payload.event;
  const data = payload.data;
  if (!event || !data || typeof data !== "object") {
    return NextResponse.json({ ok: true, ignored: true });
  }

  let service;
  try {
    service = createServiceSupabaseClient();
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  const paysuiteId = typeof data.id === "string" ? data.id : null;
  const reference = typeof data.reference === "string" ? data.reference : null;

  type PayRow = Pick<
    Database["public"]["Tables"]["payments"]["Row"],
    "id" | "payment_type" | "payment_status"
  >;

  const findPayment = async (): Promise<PayRow | null> => {
    if (paysuiteId) {
      const { data: row } = await service
        .from("payments")
        .select("id, payment_type, payment_status")
        .eq("paysuite_payment_id", paysuiteId)
        .maybeSingle();
      if (row?.id) return row as PayRow;
    }
    if (reference) {
      const { data: row } = await service
        .from("payments")
        .select("id, payment_type, payment_status")
        .eq("paysuite_reference", reference)
        .maybeSingle();
      if (row?.id) return row as PayRow;
    }
    return null;
  };

  if (event === "payment.success") {
    const row = await findPayment();
    if (!row) {
      return NextResponse.json({ ok: true, ignored: "unknown_payment" });
    }
    if (row.payment_status !== "pending") {
      return NextResponse.json({ ok: true, ignored: "not_pending" });
    }
    if (row.payment_type === "subscription" || row.payment_type === "upgrade") {
      try {
        await applyPaysuiteSubscriptionPaid(service, row.id, data);
      } catch (e) {
        console.error("PaySuite webhook apply:", e);
        return NextResponse.json({ ok: false }, { status: 500 });
      }
      return NextResponse.json({ ok: true });
    }

    await service.from("payment_logs").insert({
      payment_id: row.id,
      provider_response: {
        source: "paysuite_webhook",
        event: "payment.success",
        note: "listing_or_other_handler_not_implemented",
        payload: data as Json,
        at: new Date().toISOString(),
      } as Json,
    });
    return NextResponse.json({ ok: true, ignored: "payment_type" });
  }

  if (event === "payment.failed") {
    const row = await findPayment();
    const paymentId = row?.id;
    if (paymentId) {
      await service
        .from("payments")
        .update({ payment_status: "failed" })
        .eq("id", paymentId)
        .eq("payment_status", "pending");
      await service.from("payment_logs").insert({
        payment_id: paymentId,
        provider_response: {
          source: "paysuite_webhook",
          event: "payment.failed",
          error: (data.error as Json | undefined) ?? null,
          at: new Date().toISOString(),
        } as Json,
      });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true, ignored: event });
}

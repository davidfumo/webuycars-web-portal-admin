import { createServiceSupabaseClient } from "@/lib/supabase/admin";
import { getPaysuiteEnv } from "@/lib/paysuite/env";
import { paysuiteGetPayment } from "@/lib/paysuite/client";
import { isPaysuitePaymentRecordPaid } from "@/lib/paysuite/payment-status";
import { applyPaysuiteSubscriptionPaid } from "@/lib/payments/apply-paysuite-subscription-paid";

export type FinalizePaysuiteReturnOutcome =
  | { kind: "redirect_dashboard" }
  | { kind: "poll_client" }
  | { kind: "invalid" };

/**
 * Server-side: verifies the payment belongs to this dealer manager, then if PaySuite
 * reports paid (or DB already paid), applies subscription + onboarding completion.
 * Used on the PaySuite return URL so users are not trapped by onboarding redirect
 * before the client can poll.
 */
export async function finalizePaysuiteSubscriptionReturn(input: {
  paymentId: string;
  dealerId: string;
  userId: string;
  staffRole: string;
}): Promise<FinalizePaysuiteReturnOutcome> {
  if (input.staffRole !== "manager") {
    return { kind: "invalid" };
  }

  let service;
  try {
    service = createServiceSupabaseClient();
  } catch {
    return { kind: "poll_client" };
  }

  const { data: pay, error } = await service
    .from("payments")
    .select("id, dealer_id, payment_status, payment_type, paysuite_payment_id")
    .eq("id", input.paymentId)
    .maybeSingle();

  if (error || !pay || pay.dealer_id !== input.dealerId || pay.payment_type !== "subscription") {
    return { kind: "invalid" };
  }

  const paysuitePayload = (id: string): Record<string, unknown> =>
    id ? { id } : { id: "" };

  if (pay.payment_status === "paid") {
    await applyPaysuiteSubscriptionPaid(
      service,
      pay.id,
      paysuitePayload(typeof pay.paysuite_payment_id === "string" ? pay.paysuite_payment_id : ""),
    );
    return { kind: "redirect_dashboard" };
  }

  if (pay.payment_status !== "pending") {
    return { kind: "invalid" };
  }

  const paysuiteId =
    typeof pay.paysuite_payment_id === "string" && pay.paysuite_payment_id.length > 0
      ? pay.paysuite_payment_id
      : null;

  const env = getPaysuiteEnv();
  if (!env || !paysuiteId) {
    return { kind: "poll_client" };
  }

  try {
    const remote = await paysuiteGetPayment(env, paysuiteId);
    if (isPaysuitePaymentRecordPaid(remote)) {
      await applyPaysuiteSubscriptionPaid(service, pay.id, remote as unknown as Record<string, unknown>);
      return { kind: "redirect_dashboard" };
    }
  } catch {
    return { kind: "poll_client" };
  }

  return { kind: "poll_client" };
}

import type { PaysuitePaymentResponse } from "@/lib/paysuite/client";

const PAID_LIKE = new Set(["paid", "completed", "success", "succeeded", "successful", "complete"]);

function isPaidLikeString(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  const s = String(value).trim().toLowerCase();
  return PAID_LIKE.has(s);
}

/**
 * Whether PaySuite considers this payment settled (authoritative source while DB row
 * may still be `pending` if webhooks or return-url handling missed a beat).
 */
export function isPaysuitePaymentRecordPaid(remote: PaysuitePaymentResponse): boolean {
  const r = remote as PaysuitePaymentResponse & Record<string, unknown>;

  if (isPaidLikeString(r.status)) return true;
  if (isPaidLikeString(r.payment_status)) return true;
  if (isPaidLikeString(r.state)) return true;

  const nested = r.payment;
  if (nested && typeof nested === "object" && nested !== null) {
    const p = nested as Record<string, unknown>;
    if (isPaidLikeString(p.status) || isPaidLikeString(p.payment_status) || isPaidLikeString(p.state)) {
      return true;
    }
  }

  const tx = remote.transaction;
  if (isPaidLikeString(tx?.status)) return true;

  return false;
}
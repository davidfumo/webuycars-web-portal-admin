import { createServiceSupabaseClient } from "@/lib/supabase/admin";
import { getPaysuiteEnv } from "@/lib/paysuite/env";
import { paysuiteGetPayment } from "@/lib/paysuite/client";
import { isPaysuitePaymentRecordPaid } from "@/lib/paysuite/payment-status";
import { applyPaysuiteSubscriptionPaid } from "@/lib/payments/apply-paysuite-subscription-paid";

/**
 * For every **pending** subscription payment on this dealer that already has a PaySuite
 * session id, GET PaySuite and apply activation if they report a paid/settled state.
 *
 * Call from server-rendered dealer pages so a simple reload (or closing the PaySuite tab)
 * still reconciles with PaySuite — the hosted checkout never writes to our DB directly.
 */
export async function syncPendingPaysuiteSubscriptionPaymentsForDealer(
  dealerId: string,
): Promise<{ applied: number }> {
  const env = getPaysuiteEnv();
  if (!env) {
    return { applied: 0 };
  }

  let service;
  try {
    service = createServiceSupabaseClient();
  } catch {
    return { applied: 0 };
  }

  const { data: rows } = await service
    .from("payments")
    .select("id, paysuite_payment_id")
    .eq("dealer_id", dealerId)
    .in("payment_type", ["subscription", "upgrade"])
    .eq("payment_status", "pending")
    .not("paysuite_payment_id", "is", null);

  let applied = 0;
  for (const row of rows ?? []) {
    const pid = row.paysuite_payment_id;
    if (typeof pid !== "string" || pid.length === 0) continue;
    try {
      const remote = await paysuiteGetPayment(env, pid);
      if (isPaysuitePaymentRecordPaid(remote)) {
        await applyPaysuiteSubscriptionPaid(service, row.id, remote as unknown as Record<string, unknown>);
        applied += 1;
      }
    } catch {
      // PaySuite unreachable or unknown id — leave row pending for a later reload / webhook
    }
  }

  return { applied };
}

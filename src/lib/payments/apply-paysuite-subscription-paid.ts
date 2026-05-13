import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

function gatewayRefFromPaysuitePayload(data: Record<string, unknown>): string {
  const tx = data.transaction as Record<string, unknown> | undefined;
  const ext =
    (typeof tx?.transaction_id === "string" && tx.transaction_id) ||
    (typeof tx?.id !== "undefined" && String(tx.id)) ||
    (typeof data.id === "string" && data.id);
  return ext ? `paysuite:${ext}` : `paysuite:${String(data.id ?? "")}`;
}

/**
 * Marks subscription payment paid and activates subscription (DB RPC), then
 * clears manager onboarding flags for the payer when applicable.
 */
export async function applyPaysuiteSubscriptionPaid(
  service: SupabaseClient<Database>,
  paymentRowId: string,
  paysuiteData: Record<string, unknown>,
): Promise<void> {
  const gatewayRef = gatewayRefFromPaysuitePayload(paysuiteData);

  const { error: rpcError } = await service.rpc("complete_subscription_payment_gateway", {
    p_payment_id: paymentRowId,
    p_gateway_reference: gatewayRef,
  });
  if (rpcError) throw rpcError;

  const { data: pay } = await service
    .from("payments")
    .select("user_id, dealer_id")
    .eq("id", paymentRowId)
    .maybeSingle();

  if (pay?.dealer_id && pay.user_id) {
    await service
      .from("dealer_staff")
      .update({
        onboarding_completed_at: new Date().toISOString(),
        onboarding_required: false,
      })
      .eq("dealer_id", pay.dealer_id)
      .eq("user_id", pay.user_id)
      .eq("role", "manager");
  }
}

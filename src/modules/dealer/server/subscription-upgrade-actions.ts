"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceSupabaseClient } from "@/lib/supabase/admin";
import { computeSubscriptionUpgradeQuote } from "@/lib/dealer/compute-upgrade-quote";

async function getVerifiedUserId(): Promise<string> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("unauthorized");
  return user.id;
}

/**
 * Creates a pending `upgrade` payment for the dealer’s active subscription.
 * Cancels any older pending upgrade rows for the same subscription.
 */
export async function createSubscriptionUpgradePayment(input: {
  dealerId: string;
  targetPackageId: string;
}): Promise<{ paymentId: string; amountMzn: number }> {
  const userId = await getVerifiedUserId();
  const service = createServiceSupabaseClient();

  const { data: staff } = await service
    .from("dealer_staff")
    .select("id")
    .eq("dealer_id", input.dealerId)
    .eq("user_id", userId)
    .eq("role", "manager")
    .eq("is_active", true)
    .maybeSingle();

  if (!staff) throw new Error("forbidden");

  const { data: sub } = await service
    .from("dealer_subscriptions")
    .select("id, package_id, status, listings_used, started_at, expires_at")
    .eq("dealer_id", input.dealerId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!sub?.id || sub.status !== "active") {
    throw new Error("subscription_not_active");
  }

  if (sub.package_id === input.targetPackageId) {
    throw new Error("already_on_package");
  }

  const [{ data: currentPkg }, { data: targetPkg }] = await Promise.all([
    service.from("dealer_packages").select("*").eq("id", sub.package_id).maybeSingle(),
    service.from("dealer_packages").select("*").eq("id", input.targetPackageId).maybeSingle(),
  ]);

  if (!currentPkg || !targetPkg || !targetPkg.is_active) {
    throw new Error("package_not_found");
  }

  if (Number(targetPkg.price) <= Number(currentPkg.price)) {
    throw new Error("not_an_upgrade");
  }

  const now = Date.now();
  const quote = computeSubscriptionUpgradeQuote({
    currentPackagePrice: Number(currentPkg.price),
    targetPackagePrice: Number(targetPkg.price),
    listingLimit: currentPkg.listing_limit,
    listingsUsed: sub.listings_used ?? 0,
    periodStartMs: sub.started_at ? Date.parse(sub.started_at) : null,
    periodEndMs: sub.expires_at ? Date.parse(sub.expires_at) : null,
    nowMs: now,
  });

  await service
    .from("payments")
    .update({ payment_status: "cancelled" })
    .eq("subscription_id", sub.id)
    .eq("payment_type", "upgrade")
    .eq("payment_status", "pending");

  const { data: payment, error } = await service
    .from("payments")
    .insert({
      user_id: userId,
      dealer_id: input.dealerId,
      subscription_id: sub.id,
      amount: quote.amountMzn,
      currency: "MZN",
      payment_status: "pending",
      payment_type: "upgrade",
      target_package_id: input.targetPackageId,
    })
    .select("id")
    .single();

  if (error || !payment) throw error ?? new Error("payment_insert_failed");

  revalidatePath("/dealer/subscription");
  revalidatePath("/dealer/dashboard");
  return { paymentId: payment.id, amountMzn: quote.amountMzn };
}

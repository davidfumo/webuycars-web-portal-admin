"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceSupabaseClient } from "@/lib/supabase/admin";
import type { PaymentMethod } from "@/lib/database.types";

/**
 * Returns the verified user ID, or throws "unauthorized".
 * Always validates against the Supabase auth server (no JWT forgery possible).
 */
async function getVerifiedUserId(): Promise<string> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("unauthorized");
  return user.id;
}

export async function saveOnboardingProfile(input: { fullName: string }) {
  const userId = await getVerifiedUserId();
  const service = createServiceSupabaseClient();

  const { data: existing } = await service
    .from("profiles")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (!existing) {
    const { error } = await service.from("profiles").insert({
      user_id: userId,
      full_name: input.fullName,
    });
    if (error) throw error;
  } else {
    const { error } = await service
      .from("profiles")
      .update({ full_name: input.fullName })
      .eq("user_id", userId);
    if (error) throw error;
  }

  revalidatePath("/dealer/onboarding");
}

export async function saveOnboardingDealer(input: {
  dealerId: string;
  businessName: string;
  address?: string;
}) {
  const userId = await getVerifiedUserId();
  const service = createServiceSupabaseClient();

  // Verify the user is an active manager for this dealer
  const { data: staff } = await service
    .from("dealer_staff")
    .select("id")
    .eq("dealer_id", input.dealerId)
    .eq("user_id", userId)
    .eq("role", "manager")
    .eq("is_active", true)
    .maybeSingle();

  if (!staff) throw new Error("forbidden");

  const { error } = await service
    .from("dealers")
    .update({
      business_name: input.businessName,
      address: input.address ?? null,
    })
    .eq("id", input.dealerId);

  if (error) throw error;
  revalidatePath("/dealer/onboarding");
}

export async function createSubscriptionCheckoutPayment(input: {
  dealerId: string;
  method: PaymentMethod;
}) {
  const userId = await getVerifiedUserId();
  const service = createServiceSupabaseClient();

  // Verify the user is an active manager for this dealer
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
    .select("id, package_id, dealer_id")
    .eq("dealer_id", input.dealerId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!sub) throw new Error("missing_subscription");

  const { data: pkg } = await service
    .from("dealer_packages")
    .select("price")
    .eq("id", sub.package_id)
    .maybeSingle();

  if (!pkg) throw new Error("missing_package");

  // Re-use any pre-existing pending payment (admin may have already created one)
  const { data: existing } = await service
    .from("payments")
    .select("id")
    .eq("subscription_id", sub.id)
    .eq("payment_type", "subscription")
    .eq("payment_status", "pending")
    .maybeSingle();

  if (existing?.id) {
    await service
      .from("payments")
      .update({ amount: pkg.price, payment_method: input.method })
      .eq("id", existing.id);
    return { paymentId: existing.id };
  }

  const { data: payment, error } = await service
    .from("payments")
    .insert({
      user_id: userId,
      dealer_id: sub.dealer_id,
      subscription_id: sub.id,
      amount: pkg.price,
      currency: "MZN",
      payment_method: input.method,
      payment_status: "pending",
      payment_type: "subscription",
    })
    .select("id")
    .single();

  if (error || !payment) throw error ?? new Error("payment_insert_failed");
  return { paymentId: payment.id };
}

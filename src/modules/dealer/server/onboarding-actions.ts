"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { PaymentMethod } from "@/lib/database.types";

export async function saveOnboardingProfile(input: { fullName: string }) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("unauthorized");

  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!existing) {
    const { error } = await supabase.from("profiles").insert({
      user_id: user.id,
      full_name: input.fullName,
    });
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: input.fullName })
      .eq("user_id", user.id);
    if (error) throw error;
  }

  revalidatePath("/dealer/onboarding");
}

export async function saveOnboardingDealer(input: {
  dealerId: string;
  businessName: string;
  address?: string;
}) {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
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
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("unauthorized");

  const { data: sub } = await supabase
    .from("dealer_subscriptions")
    .select("id, package_id, dealer_id")
    .eq("dealer_id", input.dealerId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!sub) throw new Error("missing_subscription");

  const { data: pkg } = await supabase
    .from("dealer_packages")
    .select("price")
    .eq("id", sub.package_id)
    .maybeSingle();

  if (!pkg) throw new Error("missing_package");

  const { data: payment, error } = await supabase
    .from("payments")
    .insert({
      user_id: user.id,
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

export async function completeOnboardingPayment(paymentId: string) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("unauthorized");

  const { error: rpcError } = await supabase.rpc(
    "complete_subscription_payment_simulation",
    { p_payment_id: paymentId },
  );
  if (rpcError) throw rpcError;

  const { data: staff } = await supabase
    .from("dealer_staff")
    .select("id")
    .eq("user_id", user.id)
    .eq("role", "manager")
    .maybeSingle();

  if (staff) {
    await supabase
      .from("dealer_staff")
      .update({
        onboarding_completed_at: new Date().toISOString(),
        onboarding_required: false,
      })
      .eq("id", staff.id);
  }

  revalidatePath("/dealer");
  revalidatePath("/");
}

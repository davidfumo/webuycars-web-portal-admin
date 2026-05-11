"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type CreateDealerDraftResult =
  | { ok: true; listingId: string }
  | {
      ok: false;
      code:
        | "unauthorized"
        | "no_active_subscription"
        | "subscription_full"
        | "invalid_title"
        | "persist_failed";
    };

export async function createDraftDealerListing(input: {
  dealerId: string;
  title: string;
  billingMode: "subscription_allowance" | "pay_per_listing";
}): Promise<CreateDealerDraftResult> {
  const title = input.title.trim();
  if (!title) {
    return { ok: false, code: "invalid_title" };
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, code: "unauthorized" };
  }

  if (input.billingMode === "subscription_allowance") {
    const { data: sub } = await supabase
      .from("dealer_subscriptions")
      .select("id, status, listings_used, package_id")
      .eq("dealer_id", input.dealerId)
      .eq("status", "active")
      .maybeSingle();

    if (!sub) {
      return { ok: false, code: "no_active_subscription" };
    }

    const { data: pkg } = await supabase
      .from("dealer_packages")
      .select("listing_limit")
      .eq("id", sub.package_id)
      .maybeSingle();

    if (!pkg || sub.listings_used >= pkg.listing_limit) {
      return { ok: false, code: "subscription_full" };
    }
  }

  const { data, error } = await supabase
    .from("vehicle_listings")
    .insert({
      title,
      seller_type: "dealer",
      dealer_id: input.dealerId,
      status: "draft",
      currency: "MZN",
      listing_billing_mode: input.billingMode,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, code: "persist_failed" };
  }

  revalidatePath("/dealer/listings");
  return { ok: true, listingId: data.id };
}

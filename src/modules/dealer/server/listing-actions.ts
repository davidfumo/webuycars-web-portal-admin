"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceSupabaseClient } from "@/lib/supabase/admin";
import { loadDealerListingSubscriptionSnapshot } from "@/lib/dealer/dealer-listing-subscription-snapshot";

export type CreateDealerDraftResult =
  | { ok: true; listingId: string }
  | {
      ok: false;
      code:
        | "unauthorized"
        | "no_active_subscription"
        | "subscription_pending_payment"
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

  const service = createServiceSupabaseClient();
  const { data: member } = await service
    .from("dealer_staff")
    .select("id")
    .eq("dealer_id", input.dealerId)
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!member) {
    return { ok: false, code: "unauthorized" };
  }

  if (input.billingMode === "subscription_allowance") {
    const snap = await loadDealerListingSubscriptionSnapshot(input.dealerId);

    if (!snap.activeSummary) {
      if (snap.latestSubscriptionStatus === "pending_payment") {
        return { ok: false, code: "subscription_pending_payment" };
      }
      return { ok: false, code: "no_active_subscription" };
    }

    if (!snap.activeSummary.hasCapacity) {
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

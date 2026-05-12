import { createServiceSupabaseClient } from "@/lib/supabase/admin";
import type { DealerSubscriptionSummary } from "@/modules/dealer/types/subscription-summary";

export type DealerListingSubscriptionSnapshot = {
  /** Present only when the latest subscription row is `active` and its package row exists. */
  activeSummary: DealerSubscriptionSummary | null;
  /** Status of the latest subscription row for this dealer (most recent by `created_at`). */
  latestSubscriptionStatus: string | null;
  /** Package name from the latest row (for messaging when not yet active). */
  packageName: string | null;
};

/**
 * Loads dealer subscription state for listing billing using the service role so
 * results are not lost to RLS timing, policy overlap, or `dealer_packages` only
 * exposing `is_active = true` rows to the anon key (assigned packages must still
 * resolve for billing after payment).
 */
export async function loadDealerListingSubscriptionSnapshot(
  dealerId: string,
): Promise<DealerListingSubscriptionSnapshot> {
  const service = createServiceSupabaseClient();

  const { data: sub } = await service
    .from("dealer_subscriptions")
    .select("listings_used, package_id, status")
    .eq("dealer_id", dealerId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!sub) {
    return {
      activeSummary: null,
      latestSubscriptionStatus: null,
      packageName: null,
    };
  }

  const { data: pkg } = await service
    .from("dealer_packages")
    .select("name, listing_limit, price_per_extra_listing")
    .eq("id", sub.package_id)
    .maybeSingle();

  if (!pkg) {
    return {
      activeSummary: null,
      latestSubscriptionStatus: sub.status,
      packageName: null,
    };
  }

  const summary: DealerSubscriptionSummary = {
    packageName: pkg.name,
    listingsUsed: sub.listings_used,
    listingLimit: pkg.listing_limit,
    payPerExtra: Number(pkg.price_per_extra_listing),
    hasCapacity: sub.listings_used < pkg.listing_limit,
  };

  if (sub.status !== "active") {
    return {
      activeSummary: null,
      latestSubscriptionStatus: sub.status,
      packageName: pkg.name,
    };
  }

  return {
    activeSummary: summary,
    latestSubscriptionStatus: "active",
    packageName: pkg.name,
  };
}

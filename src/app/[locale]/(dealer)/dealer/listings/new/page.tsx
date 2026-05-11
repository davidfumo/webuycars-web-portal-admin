import { getTranslations } from "next-intl/server";
import { getPortalContext } from "@/lib/auth/portal";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NewDealerListingForm } from "@/modules/dealer/components/new-dealer-listing-form";
import type { DealerSubscriptionSummary } from "@/modules/dealer/types/subscription-summary";

export const dynamic = "force-dynamic";

export default async function NewDealerListingPage() {
  const ctx = await getPortalContext();
  const t = await getTranslations("Dealer");
  const supabase = await createServerSupabaseClient();

  if (!ctx || ctx.surface !== "dealer") return null;

  const { data: subRow } = await supabase
    .from("dealer_subscriptions")
    .select("listings_used, package_id")
    .eq("dealer_id", ctx.dealerId)
    .eq("status", "active")
    .maybeSingle();

  let subscription: DealerSubscriptionSummary | null = null;
  if (subRow) {
    const { data: pkg } = await supabase
      .from("dealer_packages")
      .select("name, listing_limit, price_per_extra_listing")
      .eq("id", subRow.package_id)
      .maybeSingle();
    if (pkg) {
      subscription = {
        packageName: pkg.name,
        listingsUsed: subRow.listings_used,
        listingLimit: pkg.listing_limit,
        payPerExtra: Number(pkg.price_per_extra_listing),
        hasCapacity: subRow.listings_used < pkg.listing_limit,
      };
    }
  }

  const { data: feeRows } = await supabase
    .from("dealer_packages")
    .select("price_per_extra_listing")
    .eq("is_active", true)
    .in("seller_scope", ["dealer", "all"])
    .order("price_per_extra_listing", { ascending: true })
    .limit(1);

  const referencePayPerListing = feeRows?.[0]
    ? Number(feeRows[0].price_per_extra_listing)
    : subscription?.payPerExtra ?? 0;

  const { count: privatePlanCount } = await supabase
    .from("dealer_packages")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true)
    .in("seller_scope", ["private", "all"]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("listingNew")}</h1>
      </div>
      <NewDealerListingForm
        dealerId={ctx.dealerId}
        subscription={subscription}
        referencePayPerListing={referencePayPerListing}
        privatePlanCount={privatePlanCount ?? 0}
      />
    </div>
  );
}

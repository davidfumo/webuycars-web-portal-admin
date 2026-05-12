import { getTranslations } from "next-intl/server";
import { getPortalContext } from "@/lib/auth/portal";
import { createServiceSupabaseClient } from "@/lib/supabase/admin";
import { loadDealerListingSubscriptionSnapshot } from "@/lib/dealer/dealer-listing-subscription-snapshot";
import { NewDealerListingForm } from "@/modules/dealer/components/new-dealer-listing-form";

export const dynamic = "force-dynamic";

export default async function NewDealerListingPage() {
  const ctx = await getPortalContext();
  const t = await getTranslations("Dealer");

  if (!ctx || ctx.surface !== "dealer") return null;

  const service = createServiceSupabaseClient();
  const subSnap = await loadDealerListingSubscriptionSnapshot(ctx.dealerId);

  const { data: feeRows } = await service
    .from("dealer_packages")
    .select("price_per_extra_listing")
    .eq("is_active", true)
    .in("seller_scope", ["dealer", "all"])
    .order("price_per_extra_listing", { ascending: true })
    .limit(1);

  const referencePayPerListing = feeRows?.[0]
    ? Number(feeRows[0].price_per_extra_listing)
    : subSnap.activeSummary?.payPerExtra ?? 0;

  const { count: privatePlanCount } = await service
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
        subscription={subSnap.activeSummary}
        subscriptionPendingPayment={subSnap.latestSubscriptionStatus === "pending_payment"}
        subscriptionInactiveStatus={
          subSnap.latestSubscriptionStatus &&
          subSnap.latestSubscriptionStatus !== "active" &&
          subSnap.latestSubscriptionStatus !== "pending_payment"
            ? subSnap.latestSubscriptionStatus
            : null
        }
        gatedPackageName={subSnap.packageName}
        referencePayPerListing={referencePayPerListing}
        privatePlanCount={privatePlanCount ?? 0}
      />
    </div>
  );
}

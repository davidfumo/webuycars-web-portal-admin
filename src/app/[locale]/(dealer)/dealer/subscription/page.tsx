import { getTranslations } from "next-intl/server";
import { createServiceSupabaseClient } from "@/lib/supabase/admin";
import { getPortalContext } from "@/lib/auth/portal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PayPendingSubscription } from "@/modules/dealer/components/pay-pending-subscription";
import {
  SubscriptionUpgradePlans,
  type UpgradePackageDTO,
  type UpgradeSubDTO,
} from "@/modules/dealer/components/subscription-upgrade-plans";

export const dynamic = "force-dynamic";

function toUpgradePackageDTO(p: {
  id: string;
  name: string;
  slug: string;
  listing_limit: number;
  price: number;
  price_per_extra_listing: number;
  seller_scope: string;
}): UpgradePackageDTO | null {
  if (p.seller_scope !== "dealer" && p.seller_scope !== "all") return null;
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    listing_limit: p.listing_limit,
    price: p.price,
    price_per_extra_listing: p.price_per_extra_listing,
  };
}

export default async function DealerSubscriptionPage() {
  const ctx = await getPortalContext();
  const t = await getTranslations("Dealer");
  const tNav = await getTranslations("Nav");
  const tSub = await getTranslations("Subscription");
  const tCommon = await getTranslations("Common");

  if (!ctx || ctx.surface !== "dealer") return null;

  const service = createServiceSupabaseClient();

  const [{ data: sub }, { data: packagesRaw }] = await Promise.all([
    service
      .from("dealer_subscriptions")
      .select("*")
      .eq("dealer_id", ctx.dealerId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    service.from("dealer_packages").select("*").eq("is_active", true).order("price"),
  ]);

  const packages = (packagesRaw ?? [])
    .map(toUpgradePackageDTO)
    .filter((p): p is UpgradePackageDTO => p !== null);

  const { data: currentRow } = sub?.package_id
    ? await service.from("dealer_packages").select("*").eq("id", sub.package_id).maybeSingle()
    : { data: null };

  const current: UpgradePackageDTO | null = currentRow
    ? {
        id: currentRow.id,
        name: currentRow.name,
        slug: currentRow.slug,
        listing_limit: currentRow.listing_limit,
        price: Number(currentRow.price),
        price_per_extra_listing: Number(currentRow.price_per_extra_listing),
      }
    : null;

  const { data: pendingPayment } =
    sub && sub.status === "pending_payment"
      ? await service
          .from("payments")
          .select("id")
          .eq("subscription_id", sub.id)
          .eq("payment_type", "subscription")
          .eq("payment_status", "pending")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : { data: null };

  const { data: pendingUpgrade } =
    sub && sub.status === "active"
      ? await service
          .from("payments")
          .select("id, amount, target_package_id")
          .eq("dealer_id", ctx.dealerId)
          .eq("payment_type", "upgrade")
          .eq("payment_status", "pending")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : { data: null };

  const isManager = ctx.portalRole === "dealer_manager";

  const subDto: UpgradeSubDTO | null = sub
    ? {
        package_id: sub.package_id,
        listings_used: sub.listings_used ?? 0,
        started_at: sub.started_at,
        expires_at: sub.expires_at,
        status: sub.status,
      }
    : null;

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{tNav("dealerSubscription")}</h1>
        {!isManager && (
          <p className="mt-1 text-sm text-muted-foreground">{t("managerOnlyPayments")}</p>
        )}
      </div>

      {sub?.status === "pending_payment" && current && isManager && (
        <PayPendingSubscription
          dealerId={ctx.dealerId}
          existingPaymentId={pendingPayment?.id ?? null}
          packageName={current.name}
          packagePrice={Number(current.price)}
        />
      )}

      <Card className="overflow-hidden rounded-2xl border-border shadow-md">
        <CardHeader className="border-b border-border/80 bg-muted/30 pb-4">
          <CardTitle className="text-base font-semibold">{t("subscriptionCurrent")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 pt-6 text-sm md:grid-cols-2">
          <div className="flex justify-between gap-3 rounded-lg bg-background/80 px-3 py-2">
            <span className="text-muted-foreground">{tCommon("name")}</span>
            <span className="font-medium">{current?.name ?? "—"}</span>
          </div>
          <div className="flex justify-between gap-3 rounded-lg bg-background/80 px-3 py-2">
            <span className="text-muted-foreground">{tCommon("status")}</span>
            <Badge variant="secondary" className="font-medium">
              {sub?.status ? tSub(`status_${sub.status}` as "status_active") : "—"}
            </Badge>
          </div>
          <div className="flex justify-between gap-3 rounded-lg bg-background/80 px-3 py-2 md:col-span-2">
            <span className="text-muted-foreground">{tSub("expires")}</span>
            <span className="font-medium tabular-nums">
              {sub?.expires_at ? new Date(sub.expires_at).toLocaleDateString() : "—"}
            </span>
          </div>
        </CardContent>
      </Card>

      {current && subDto ? (
        <SubscriptionUpgradePlans
          dealerId={ctx.dealerId}
          isManager={isManager}
          currentPackage={current}
          subscription={subDto}
          packages={packages}
          pendingUpgrade={pendingUpgrade}
        />
      ) : null}
    </div>
  );
}

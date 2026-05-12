import { getTranslations } from "next-intl/server";
import { createServiceSupabaseClient } from "@/lib/supabase/admin";
import { getPortalContext } from "@/lib/auth/portal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PayPendingSubscription } from "@/modules/dealer/components/pay-pending-subscription";

export const dynamic = "force-dynamic";

export default async function DealerDashboardPage() {
  const ctx = await getPortalContext();
  const t = await getTranslations("Dealer");
  const tSub = await getTranslations("Subscription");
  const tCommon = await getTranslations("Common");

  if (!ctx || ctx.surface !== "dealer") return null;

  const dealerId = ctx.dealerId;
  const service = createServiceSupabaseClient();

  const [{ data: sub }, listingsCounts, listingIds] = await Promise.all([
    service
      .from("dealer_subscriptions")
      .select("id,status,expires_at,listings_used,package_id")
      .eq("dealer_id", dealerId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    service.from("vehicle_listings").select("status").eq("dealer_id", dealerId).limit(5000),
    service.from("vehicle_listings").select("id").eq("dealer_id", dealerId).limit(2000),
  ]);

  const ids = (listingIds.data ?? []).map((l) => l.id);
  const leads =
    ids.length > 0
      ? await service.from("leads").select("id", { count: "exact", head: true }).in("listing_id", ids)
      : { count: 0 };

  const { data: pkg } = sub?.package_id
    ? await service.from("dealer_packages").select("*").eq("id", sub.package_id).maybeSingle()
    : { data: null };

  // Pending subscription payment (if admin pre-provisioned it)
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

  const byStatus = new Map<string, number>();
  for (const row of listingsCounts.data ?? []) {
    byStatus.set(row.status, (byStatus.get(row.status) ?? 0) + 1);
  }

  const used = sub?.listings_used ?? 0;
  const limit = pkg?.listing_limit ?? 0;
  const remaining = Math.max(0, limit - used);
  const isManager = ctx.portalRole === "dealer_manager";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("dashboardTitle")}</h1>
        {!isManager && (
          <p className="text-sm text-muted-foreground">{t("managerOnlyPayments")}</p>
        )}
      </div>

      {/* Pending payment banner */}
      {sub?.status === "pending_payment" && pkg && isManager && (
        <PayPendingSubscription
          dealerId={dealerId}
          existingPaymentId={pendingPayment?.id ?? null}
          packageName={pkg.name}
          packagePrice={Number(pkg.price)}
        />
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("subscriptionCurrent")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-lg font-semibold">{pkg?.name ?? "—"}</div>
            <Badge variant="secondary">
              {sub?.status
                ? tSub(`status_${sub.status}` as "status_active")
                : tSub("status_pending_payment")}
            </Badge>
            <div className="text-xs text-muted-foreground">
              {tSub("expires")}: {sub?.expires_at ? new Date(sub.expires_at).toLocaleDateString() : "—"}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("listingsUsed")}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">
            {used} / {limit}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("listingsRemaining")}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{remaining}</CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("leads")}</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{leads.count ?? 0}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{tCommon("status")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 md:grid-cols-3">
          {["draft", "pending_review", "published", "sold", "rejected", "expired"].map((status) => (
            <div key={status} className="flex items-center justify-between rounded-lg border border-border p-3 text-sm">
              <span className="text-muted-foreground">{status}</span>
              <span className="font-semibold">{byStatus.get(status) ?? 0}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

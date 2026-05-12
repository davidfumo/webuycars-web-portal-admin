import { getTranslations } from "next-intl/server";
import { createServiceSupabaseClient } from "@/lib/supabase/admin";
import { getPortalContext } from "@/lib/auth/portal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PayPendingSubscription } from "@/modules/dealer/components/pay-pending-subscription";

export const dynamic = "force-dynamic";

export default async function DealerSubscriptionPage() {
  const ctx = await getPortalContext();
  const t = await getTranslations("Dealer");
  const tNav = await getTranslations("Nav");
  const tSub = await getTranslations("Subscription");
  const tCommon = await getTranslations("Common");

  if (!ctx || ctx.surface !== "dealer") return null;

  const service = createServiceSupabaseClient();

  const [{ data: sub }, { data: packages }] = await Promise.all([
    service
      .from("dealer_subscriptions")
      .select("*")
      .eq("dealer_id", ctx.dealerId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    service.from("dealer_packages").select("*").eq("is_active", true).order("price"),
  ]);

  const current = sub?.package_id
    ? packages?.find((p) => p.id === sub.package_id)
    : null;

  // Check for a pending subscription payment (may have been admin-provisioned)
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

  const isManager = ctx.portalRole === "dealer_manager";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{tNav("dealerSubscription")}</h1>
        {!isManager && (
          <p className="text-sm text-muted-foreground">{t("managerOnlyPayments")}</p>
        )}
      </div>

      {/* Pending payment CTA — only managers can pay */}
      {sub?.status === "pending_payment" && current && isManager && (
        <PayPendingSubscription
          dealerId={ctx.dealerId}
          existingPaymentId={pendingPayment?.id ?? null}
          packageName={current.name}
          packagePrice={Number(current.price)}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("subscriptionCurrent")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm md:grid-cols-2">
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">{tCommon("name")}</span>
            <span className="font-medium">{current?.name ?? "—"}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">{tCommon("status")}</span>
            <Badge variant="secondary">
              {sub?.status ? tSub(`status_${sub.status}` as "status_active") : "—"}
            </Badge>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">{tSub("expires")}</span>
            <span>{sub?.expires_at ? new Date(sub.expires_at).toLocaleDateString() : "—"}</span>
          </div>
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-3 text-lg font-semibold">{t("upgrade")}</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(packages ?? []).map((p) => (
            <Card key={p.id}>
              <CardHeader>
                <CardTitle className="text-base">{p.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Listings</span>
                  <span>{p.listing_limit}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{tCommon("currency")}</span>
                  <span>{Number(p.price).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Extra</span>
                  <span>{Number(p.price_per_extra_listing).toLocaleString()}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

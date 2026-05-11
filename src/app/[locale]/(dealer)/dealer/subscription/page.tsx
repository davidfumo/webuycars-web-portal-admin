import { getTranslations } from "next-intl/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getPortalContext } from "@/lib/auth/portal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function DealerSubscriptionPage() {
  const supabase = await createServerSupabaseClient();
  const ctx = await getPortalContext();
  const t = await getTranslations("Dealer");
  const tNav = await getTranslations("Nav");
  const tSub = await getTranslations("Subscription");
  const tCommon = await getTranslations("Common");

  if (!ctx || ctx.surface !== "dealer") return null;

  const [{ data: sub }, { data: packages }] = await Promise.all([
    supabase
      .from("dealer_subscriptions")
      .select("*")
      .eq("dealer_id", ctx.dealerId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("dealer_packages").select("*").eq("is_active", true).order("price"),
  ]);

  const current = sub?.package_id
    ? packages?.find((p) => p.id === sub.package_id)
    : null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{tNav("dealerSubscription")}</h1>
        <p className="text-sm text-muted-foreground">
          {ctx.portalRole === "dealer_staff" ? t("managerOnlyPayments") : null}
        </p>
      </div>

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

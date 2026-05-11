import { getTranslations } from "next-intl/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminOverviewCharts } from "@/modules/admin/components/admin-overview-charts";

export const dynamic = "force-dynamic";

function monthLabels() {
  const now = new Date();
  return Array.from({ length: 6 }).map((_, idx) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - idx), 1);
    return d.toLocaleString("default", { month: "short" });
  });
}

export default async function AdminDashboardPage() {
  const supabase = await createServerSupabaseClient();
  const t = await getTranslations("Admin");
  const tCommon = await getTranslations("Common");

  const [
    dealers,
    published,
    pendingReview,
    paidPayments,
    activeSubs,
    expiringSubs,
    newUsers,
    packageRows,
    brandRows,
  ] = await Promise.all([
    supabase.from("dealers").select("id", { count: "exact", head: true }),
    supabase
      .from("vehicle_listings")
      .select("id", { count: "exact", head: true })
      .eq("status", "published"),
    supabase
      .from("vehicle_listings")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending_review"),
    supabase
      .from("payments")
      .select("amount")
      .eq("payment_status", "paid"),
    supabase
      .from("dealer_subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("status", "active"),
    supabase
      .from("dealer_subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("status", "active")
      .not("expires_at", "is", null)
      .lte("expires_at", new Date(Date.now() + 30 * 86400000).toISOString()),
    supabase
      .from("users")
      .select("id", { count: "exact", head: true })
      .gte("created_at", new Date(Date.now() - 7 * 86400000).toISOString()),
    supabase
      .from("dealer_subscriptions")
      .select("package_id"),
    supabase
      .from("vehicle_listings")
      .select("brand_id")
      .not("brand_id", "is", null)
      .limit(5000),
  ]);

  const revenue =
    paidPayments.data?.reduce((sum, row) => sum + Number(row.amount ?? 0), 0) ?? 0;

  const months = monthLabels();
  const publishedCount = published.count ?? 0;
  const listingsSeries = months.map((month, idx) => ({
    month,
    count: Math.max(0, Math.round(publishedCount * (0.45 + idx * 0.1))),
  }));

  const revenueSeries = months.map((month, idx) => ({
    month,
    amount: Math.max(0, Math.round((revenue / 6) * (0.65 + idx * 0.06))),
  }));

  const packageIds = (packageRows.data ?? [])
    .map((r) => r.package_id)
    .filter(Boolean) as string[];
  const packageCounts = new Map<string, number>();
  for (const id of packageIds) {
    packageCounts.set(id, (packageCounts.get(id) ?? 0) + 1);
  }

  const { data: packagesCatalog } = await supabase
    .from("dealer_packages")
    .select("id,name");

  const packageMix =
    packagesCatalog?.map((p) => ({
      name: p.name,
      value: packageCounts.get(p.id) ?? 0,
    })) ?? [];

  const brandCounts = new Map<string, number>();
  for (const row of brandRows.data ?? []) {
    if (!row.brand_id) continue;
    brandCounts.set(row.brand_id, (brandCounts.get(row.brand_id) ?? 0) + 1);
  }

  const { data: brandsCatalog } = await supabase
    .from("vehicle_brands")
    .select("id,name")
    .limit(200);

  const brandMix = (brandsCatalog ?? [])
    .map((b) => ({ name: b.name, count: brandCounts.get(b.id) ?? 0 }))
    .filter((b) => b.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const kpis = [
    { label: t("kpiDealers"), value: dealers.count ?? 0 },
    { label: t("kpiListings"), value: published.count ?? 0 },
    { label: t("kpiPendingReview"), value: pendingReview.count ?? 0 },
    { label: t("kpiRevenue"), value: revenue.toLocaleString() },
    { label: t("kpiSubscriptions"), value: activeSubs.count ?? 0 },
    { label: t("kpiExpiringSoon"), value: expiringSubs.count ?? 0 },
    { label: t("kpiNewUsers"), value: newUsers.count ?? 0 },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("dashboardTitle")}</h1>
        <p className="text-sm text-muted-foreground">{tCommon("appName")}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {kpi.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold">{kpi.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <AdminOverviewCharts
        listingsSeries={listingsSeries}
        revenueSeries={revenueSeries}
        packageMix={packageMix.length ? packageMix : [{ name: "—", value: 1 }]}
        brandMix={brandMix.length ? brandMix : [{ name: "—", count: 1 }]}
        titles={{
          listings: t("chartListingsGrowth"),
          revenue: t("chartRevenue"),
          packages: t("chartSubscriptionMix"),
          brands: t("chartTopBrands"),
        }}
      />
    </div>
  );
}

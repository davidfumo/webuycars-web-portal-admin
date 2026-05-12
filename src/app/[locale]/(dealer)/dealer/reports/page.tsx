import { getTranslations } from "next-intl/server";
import { createServiceSupabaseClient } from "@/lib/supabase/admin";
import { getPortalContext } from "@/lib/auth/portal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function DealerReportsPage() {
  const ctx = await getPortalContext();
  const t = await getTranslations("Dealer");
  if (!ctx || ctx.surface !== "dealer") return null;

  const service = createServiceSupabaseClient();
  const { data: listings } = await service
    .from("vehicle_listings")
    .select("views_count,favorites_count,leads_count,status")
    .eq("dealer_id", ctx.dealerId)
    .limit(5000);

  const totals = (listings ?? []).reduce(
    (acc, row) => {
      acc.views += row.views_count ?? 0;
      acc.favorites += row.favorites_count ?? 0;
      acc.leads += row.leads_count ?? 0;
      return acc;
    },
    { views: 0, favorites: 0, leads: 0 },
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("reportsTitle")}</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Views</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{totals.views}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Favorites</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{totals.favorites}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("leads")}</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{totals.leads}</CardContent>
        </Card>
      </div>
    </div>
  );
}

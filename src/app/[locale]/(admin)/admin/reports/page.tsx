import { getTranslations } from "next-intl/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function AdminReportsPage() {
  const supabase = await createServerSupabaseClient();
  const t = await getTranslations("Admin");
  const tCommon = await getTranslations("Common");

  const [{ count: dealers }, { count: listings }, { data: revenueRows }] = await Promise.all([
    supabase.from("dealers").select("id", { count: "exact", head: true }),
    supabase.from("vehicle_listings").select("id", { count: "exact", head: true }),
    supabase.from("payments").select("amount").eq("payment_status", "paid").limit(5000),
  ]);

  const revenue =
    revenueRows?.reduce((sum, r) => sum + Number(r.amount ?? 0), 0) ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("reportsTitle")}</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("kpiDealers")}</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{dealers ?? 0}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("kpiListings")}</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{listings ?? 0}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("kpiRevenue")}</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">
            {revenue.toLocaleString()} {tCommon("currency")}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

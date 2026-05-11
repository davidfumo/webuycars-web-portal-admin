import { getTranslations } from "next-intl/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function AdminPackagesPage() {
  const supabase = await createServerSupabaseClient();
  const t = await getTranslations("Admin");
  const tCommon = await getTranslations("Common");

  const { data: packages } = await supabase
    .from("dealer_packages")
    .select("*")
    .order("price", { ascending: true });

  const { data: usage } = await supabase.from("dealer_subscriptions").select("package_id");

  const counts = new Map<string, number>();
  for (const row of usage ?? []) {
    counts.set(row.package_id, (counts.get(row.package_id) ?? 0) + 1);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("packagesTitle")}</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {(packages ?? []).map((p) => (
          <Card key={p.id}>
            <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
              <div>
                <CardTitle className="text-lg">{p.name}</CardTitle>
                <p className="text-sm text-muted-foreground">{p.slug}</p>
              </div>
              <Badge variant={p.is_active ? "success" : "secondary"}>
                {p.is_active ? tCommon("active") : tCommon("inactive")}
              </Badge>
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
                <span className="text-muted-foreground">Extra listing</span>
                <span>{Number(p.price_per_extra_listing).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Duration</span>
                <span>{p.duration_days}d</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Usage</span>
                <span>{counts.get(p.id) ?? 0}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

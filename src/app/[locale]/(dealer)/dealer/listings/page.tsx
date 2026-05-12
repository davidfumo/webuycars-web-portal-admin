import { getTranslations } from "next-intl/server";
import { createServiceSupabaseClient } from "@/lib/supabase/admin";
import { getPortalContext } from "@/lib/auth/portal";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function DealerListingsPage() {
  const ctx = await getPortalContext();
  const t = await getTranslations("Dealer");
  const tCommon = await getTranslations("Common");
  const tList = await getTranslations("Listing");

  if (!ctx || ctx.surface !== "dealer") return null;

  const service = createServiceSupabaseClient();
  const { data: rows } = await service
    .from("vehicle_listings")
    .select("id,title,status,created_at,price,currency")
    .eq("dealer_id", ctx.dealerId)
    .order("created_at", { ascending: false })
    .limit(300);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("listingsTitle")}</h1>
        </div>
        <Button asChild>
          <Link href="/dealer/listings/new">{t("listingNew")}</Link>
        </Button>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">{tCommon("name")}</th>
                <th className="px-4 py-3">{tCommon("status")}</th>
                <th className="px-4 py-3">{tCommon("currency")}</th>
              </tr>
            </thead>
            <tbody>
              {(rows ?? []).map((l) => (
                <tr key={l.id} className="border-t border-border">
                  <td className="px-4 py-3 font-medium">{l.title}</td>
                  <td className="px-4 py-3">
                    <Badge variant="secondary">
                      {tList(`status_${l.status}` as "status_draft")}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    {l.price != null ? Number(l.price).toLocaleString() : "—"} {l.currency}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

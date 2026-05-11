import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function DealerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const t = await getTranslations("Admin");
  const tCommon = await getTranslations("Common");

  const { data: dealer } = await supabase.from("dealers").select("*").eq("id", id).maybeSingle();
  if (!dealer) notFound();

  const [{ data: subs }, { data: listings }, { data: payments }] = await Promise.all([
    supabase
      .from("dealer_subscriptions")
      .select("id,status,expires_at,package_id")
      .eq("dealer_id", id)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("vehicle_listings")
      .select("id,title,status,created_at")
      .eq("dealer_id", id)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("payments")
      .select("id,amount,payment_status,payment_type,created_at")
      .eq("dealer_id", id)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{dealer.business_name}</h1>
          <p className="text-sm text-muted-foreground">{dealer.contact_email}</p>
        </div>
        <Badge variant={dealer.is_active ? "success" : "secondary"}>
          {dealer.is_active ? tCommon("active") : tCommon("inactive")}
        </Badge>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">{t("dealerStats")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{tCommon("phone")}</span>
              <span>{dealer.contact_phone ?? "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{tCommon("address")}</span>
              <span className="max-w-[60%] text-right">{dealer.address ?? "—"}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">{t("kpiSubscriptions")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {(subs ?? []).length ? (
              subs!.map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div>
                    <div className="font-medium">{s.status}</div>
                    <div className="text-xs text-muted-foreground">{s.expires_at ?? "—"}</div>
                  </div>
                  <Badge variant="outline">{s.package_id.slice(0, 8)}</Badge>
                </div>
              ))
            ) : (
              <div className="text-muted-foreground">{tCommon("noData")}</div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("listingsTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="py-2">{tCommon("name")}</th>
                <th className="py-2">{tCommon("status")}</th>
              </tr>
            </thead>
            <tbody>
              {(listings ?? []).map((l) => (
                <tr key={l.id} className="border-t border-border">
                  <td className="py-2">{l.title}</td>
                  <td className="py-2">{l.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("paymentsTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="py-2">{tCommon("status")}</th>
                <th className="py-2">{tCommon("currency")}</th>
                <th className="py-2">{tCommon("updatedAt")}</th>
              </tr>
            </thead>
            <tbody>
              {(payments ?? []).map((p) => (
                <tr key={p.id} className="border-t border-border">
                  <td className="py-2">{p.payment_status}</td>
                  <td className="py-2">{Number(p.amount).toLocaleString()}</td>
                  <td className="py-2">{new Date(p.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

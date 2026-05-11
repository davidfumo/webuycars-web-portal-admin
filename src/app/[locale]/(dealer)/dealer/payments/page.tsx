import { getTranslations } from "next-intl/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getPortalContext } from "@/lib/auth/portal";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function DealerPaymentsPage() {
  const supabase = await createServerSupabaseClient();
  const ctx = await getPortalContext();
  const t = await getTranslations("Dealer");
  const tPay = await getTranslations("Payment");
  const tCommon = await getTranslations("Common");

  if (!ctx || ctx.surface !== "dealer") return null;

  const { data: rows } = await supabase
    .from("payments")
    .select("id,amount,currency,payment_status,payment_type,payment_method,created_at")
    .eq("dealer_id", ctx.dealerId)
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("paymentsTitle")}</h1>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">{tCommon("status")}</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">{tCommon("currency")}</th>
                <th className="px-4 py-3">{tCommon("updatedAt")}</th>
              </tr>
            </thead>
            <tbody>
              {(rows ?? []).map((p) => (
                <tr key={p.id} className="border-t border-border">
                  <td className="px-4 py-3">
                    <Badge variant={p.payment_status === "paid" ? "success" : "secondary"}>
                      {tPay(`status_${p.payment_status}` as "status_pending")}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">{p.payment_type}</td>
                  <td className="px-4 py-3">
                    {Number(p.amount).toLocaleString()} {p.currency}
                  </td>
                  <td className="px-4 py-3">{new Date(p.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

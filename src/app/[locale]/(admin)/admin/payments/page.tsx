import { getTranslations } from "next-intl/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function AdminPaymentsPage() {
  const supabase = await createServerSupabaseClient();
  const t = await getTranslations("Admin");
  const tCommon = await getTranslations("Common");
  const tPay = await getTranslations("Payment");

  const { data: rows } = await supabase
    .from("payments")
    .select("id,amount,currency,payment_status,payment_type,payment_method,created_at,dealer_id")
    .order("created_at", { ascending: false })
    .limit(300);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("paymentsTitle")}</h1>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">{tCommon("status")}</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">{tCommon("currency")}</th>
                <th className="px-4 py-3">Method</th>
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
                  <td className="px-4 py-3">{p.payment_method ?? "—"}</td>
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

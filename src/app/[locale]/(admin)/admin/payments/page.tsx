import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STATUS_FILTERS = ["all", "pending", "paid", "failed", "refunded", "cancelled"] as const;
const TYPE_FILTERS = [
  "all",
  "subscription",
  "listing",
  "extra_listing",
  "sponsorship",
  "feature",
  "upgrade",
  "other",
] as const;

type StatusFilter = (typeof STATUS_FILTERS)[number];
type TypeFilter = (typeof TYPE_FILTERS)[number];

function isStatusFilter(s: string | undefined): s is StatusFilter {
  return STATUS_FILTERS.includes(s as StatusFilter);
}

function isTypeFilter(s: string | undefined): s is TypeFilter {
  return TYPE_FILTERS.includes(s as TypeFilter);
}

function badgeVariant(
  status: string,
): "success" | "warning" | "danger" | "secondary" | "outline" {
  if (status === "paid") return "success";
  if (status === "pending") return "warning";
  if (status === "failed") return "danger";
  if (status === "refunded" || status === "cancelled") return "outline";
  return "secondary";
}

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string; type?: string }>;
}) {
  const sp = searchParams ? await searchParams : {};
  const statusParam = isStatusFilter(sp.status) ? sp.status : "all";
  const typeParam = isTypeFilter(sp.type) ? sp.type : "all";

  const supabase = await createServerSupabaseClient();
  const t = await getTranslations("Admin");
  const tCommon = await getTranslations("Common");
  const tPay = await getTranslations("Payment");

  let query = supabase
    .from("payments")
    .select(
      "id,amount,currency,payment_status,payment_type,payment_method,created_at,dealer_id,subscription_id",
    )
    .order("created_at", { ascending: false })
    .limit(500);

  if (statusParam !== "all") {
    query = query.eq("payment_status", statusParam);
  }
  if (typeParam !== "all") {
    query = query.eq("payment_type", typeParam);
  }

  const { data: rows } = await query;

  const dealerIds = [
    ...new Set((rows ?? []).map((r) => r.dealer_id).filter((id): id is string => Boolean(id))),
  ];
  let dealerNames: Record<string, string> = {};
  if (dealerIds.length > 0) {
    const { data: dealers } = await supabase
      .from("dealers")
      .select("id,business_name")
      .in("id", dealerIds);
    dealerNames = Object.fromEntries(
      (dealers ?? []).map((d) => [d.id, d.business_name ?? "—"]),
    );
  }

  function href(next: { status?: StatusFilter; type?: TypeFilter }) {
    const s = next.status ?? statusParam;
    const ty = next.type ?? typeParam;
    const qs = new URLSearchParams();
    if (s !== "all") qs.set("status", s);
    if (ty !== "all") qs.set("type", ty);
    const q = qs.toString();
    return q ? `/admin/payments?${q}` : "/admin/payments";
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("paymentsTitle")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("paymentsFilterIntro")}</p>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium uppercase text-muted-foreground">
            {t("paymentsFilterStatus")}
          </span>
          {STATUS_FILTERS.map((s) => (
            <Link
              key={s}
              href={href({ status: s })}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                statusParam === s
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:bg-muted",
              )}
            >
              {s === "all" ? t("paymentsFilterAll") : tPay(`status_${s}` as "status_pending")}
            </Link>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium uppercase text-muted-foreground">
            {t("paymentsFilterType")}
          </span>
          {TYPE_FILTERS.map((ty) => (
            <Link
              key={ty}
              href={href({ type: ty })}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                typeParam === ty
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:bg-muted",
              )}
            >
              {ty === "all" ? t("paymentsFilterAll") : t(`paymentType_${ty}`)}
            </Link>
          ))}
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-sm">
            <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">{tCommon("status")}</th>
                <th className="px-4 py-3">{t("paymentsColDealer")}</th>
                <th className="px-4 py-3">{t("paymentsColType")}</th>
                <th className="px-4 py-3">{tCommon("currency")}</th>
                <th className="px-4 py-3">{t("paymentsColMethod")}</th>
                <th className="px-4 py-3">{tCommon("updatedAt")}</th>
              </tr>
            </thead>
            <tbody>
              {(rows ?? []).map((p) => (
                <tr key={p.id} className="border-t border-border">
                  <td className="px-4 py-3">
                    <Badge variant={badgeVariant(p.payment_status)}>
                      {tPay(`status_${p.payment_status}` as "status_pending")}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    {p.dealer_id ? (
                      <Link
                        href={`/admin/dealers/${p.dealer_id}`}
                        className="font-medium text-primary underline-offset-4 hover:underline"
                      >
                        {dealerNames[p.dealer_id] ?? p.dealer_id.slice(0, 8)}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{t(`paymentType_${p.payment_type}`)}</td>
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

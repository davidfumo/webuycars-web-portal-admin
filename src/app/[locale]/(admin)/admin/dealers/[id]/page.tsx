import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DealerAdminPanel } from "@/modules/admin/components/dealer-admin-panel";
import { DealerDetailTeamPanel } from "@/modules/admin/components/dealer-detail-team-panel";

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

  const [
    { data: provinces },
    { data: packages },
    { data: subs },
    { data: listings },
    { data: payments },
    { data: staffRows },
  ] = await Promise.all([
    supabase.from("provinces").select("id,name").eq("is_active", true).order("name"),
    supabase.from("dealer_packages").select("id,name,price").eq("is_active", true).order("price"),
    supabase
      .from("dealer_subscriptions")
      .select("id,status,expires_at,package_id,created_at")
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
    supabase
      .from("dealer_staff")
      .select("id,user_id,role,is_active,onboarding_required,onboarding_completed_at")
      .eq("dealer_id", id)
      .order("role", { ascending: true }),
  ]);

  const userIds = [...new Set((staffRows ?? []).map((s) => s.user_id))];
  const { data: userRows } =
    userIds.length > 0
      ? await supabase.from("users").select("id,email,role").in("id", userIds)
      : { data: [] as { id: string; email: string | null; role: string }[] };

  const userById = Object.fromEntries((userRows ?? []).map((u) => [u.id, u]));

  const teamMembers = (staffRows ?? []).map((s) => {
    const u = userById[s.user_id];
    const onboardingRequired = Boolean(s.onboarding_required);
    const completed = s.onboarding_completed_at != null;
    return {
      staffId: s.id,
      userId: s.user_id,
      portalRole: s.role,
      appRole: u?.role ?? null,
      email: u?.email?.trim() ?? null,
      isActive: s.is_active,
      setupPending: onboardingRequired && !completed,
    };
  });

  const latestSub = subs?.[0] ?? null;

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

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
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

          <DealerDetailTeamPanel dealerId={id} members={teamMembers} />

          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-base">{t("kpiSubscriptions")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {(subs ?? []).length ? (
                subs!.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between rounded-lg border border-border p-3"
                  >
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

        <div>
          <DealerAdminPanel
            dealer={dealer}
            provinces={provinces ?? []}
            packages={packages ?? []}
            latestSub={
              latestSub
                ? { id: latestSub.id, status: latestSub.status, package_id: latestSub.package_id }
                : null
            }
          />
        </div>
      </div>
    </div>
  );
}

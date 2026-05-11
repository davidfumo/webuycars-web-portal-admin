import { getTranslations } from "next-intl/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getPortalContext } from "@/lib/auth/portal";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function DealerStaffPage() {
  const supabase = await createServerSupabaseClient();
  const ctx = await getPortalContext();
  const t = await getTranslations("Dealer");
  const tCommon = await getTranslations("Common");

  if (!ctx || ctx.surface !== "dealer") return null;

  const { data: staff } = await supabase
    .from("dealer_staff")
    .select("id,user_id,role,is_active,onboarding_required,onboarding_completed_at")
    .eq("dealer_id", ctx.dealerId)
    .order("role", { ascending: true });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("staffTitle")}</h1>
        <p className="text-sm text-muted-foreground">
          {ctx.portalRole === "dealer_staff" ? t("managerOnlyPayments") : t("staffInvite")}
        </p>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">{tCommon("status")}</th>
              </tr>
            </thead>
            <tbody>
              {(staff ?? []).map((s) => (
                <tr key={s.id} className="border-t border-border">
                  <td className="px-4 py-3 font-mono text-xs">{s.user_id}</td>
                  <td className="px-4 py-3">{s.role}</td>
                  <td className="px-4 py-3">
                    <Badge variant={s.is_active ? "success" : "secondary"}>
                      {s.is_active ? tCommon("active") : tCommon("inactive")}
                    </Badge>
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

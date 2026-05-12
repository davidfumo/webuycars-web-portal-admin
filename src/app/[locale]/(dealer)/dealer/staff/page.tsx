import { getTranslations } from "next-intl/server";
import { createServiceSupabaseClient } from "@/lib/supabase/admin";
import { getPortalContext } from "@/lib/auth/portal";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DealerInviteStaffForm } from "@/modules/dealer/components/dealer-invite-staff-form";

export const dynamic = "force-dynamic";

export default async function DealerStaffPage() {
  const ctx = await getPortalContext();
  const t = await getTranslations("Dealer");
  const tCommon = await getTranslations("Common");
  const tUsers = await getTranslations("UsersAdmin");

  if (!ctx || ctx.surface !== "dealer") return null;

  const service = createServiceSupabaseClient();

  const { data: staff } = await service
    .from("dealer_staff")
    .select("id,user_id,role,is_active,onboarding_required,onboarding_completed_at")
    .eq("dealer_id", ctx.dealerId)
    .order("role", { ascending: true });

  const userIds = [...new Set((staff ?? []).map((s) => s.user_id))];
  const { data: userRows } =
    userIds.length > 0
      ? await service.from("users").select("id,email,role").in("id", userIds)
      : { data: [] as { id: string; email: string | null; role: string }[] };

  const userById = Object.fromEntries((userRows ?? []).map((u) => [u.id, u]));

  const canInvite = ctx.portalRole === "dealer_manager";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("staffTitle")}</h1>
        <p className="text-sm text-muted-foreground">
          {ctx.portalRole === "dealer_staff" ? t("managerOnlyPayments") : t("staffInvite")}
        </p>
      </div>

      {canInvite ? (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {tUsers("inviteStaffSection")}
          </h2>
          <DealerInviteStaffForm canInvite />
        </div>
      ) : null}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">{tCommon("email")}</th>
                <th className="px-4 py-3">{tUsers("dealerTeamColPortal")}</th>
                <th className="px-4 py-3">{tUsers("dealerTeamColAccount")}</th>
                <th className="px-4 py-3">{tCommon("status")}</th>
              </tr>
            </thead>
            <tbody>
              {(staff ?? []).map((s) => {
                const u = userById[s.user_id];
                return (
                  <tr key={s.id} className="border-t border-border">
                    <td className="px-4 py-3 font-medium">{u?.email ?? "—"}</td>
                    <td className="px-4 py-3">{s.role}</td>
                    <td className="px-4 py-3 text-muted-foreground">{u?.role ?? "—"}</td>
                    <td className="px-4 py-3">
                      <Badge variant={s.is_active ? "success" : "secondary"}>
                        {s.is_active ? tCommon("active") : tCommon("inactive")}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

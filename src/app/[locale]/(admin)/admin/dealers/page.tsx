import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function AdminDealersPage() {
  const supabase = await createServerSupabaseClient();
  const t = await getTranslations("Admin");
  const tCommon = await getTranslations("Common");

  const { data: dealers } = await supabase
    .from("dealers")
    .select("id,business_name,contact_email,is_active,created_at,slug")
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("dealersTitle")}</h1>
          <p className="text-sm text-muted-foreground">{tCommon("search")}</p>
        </div>
        <Button asChild>
          <Link href="/admin/dealers/new">{t("dealerNew")}</Link>
        </Button>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">{tCommon("name")}</th>
                <th className="px-4 py-3">{tCommon("email")}</th>
                <th className="px-4 py-3">{tCommon("status")}</th>
                <th className="px-4 py-3">{tCommon("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {(dealers ?? []).map((d) => (
                <tr key={d.id} className="border-t border-border">
                  <td className="px-4 py-3 font-medium">{d.business_name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{d.contact_email}</td>
                  <td className="px-4 py-3">
                    <Badge variant={d.is_active ? "success" : "secondary"}>
                      {d.is_active ? tCommon("active") : tCommon("inactive")}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/admin/dealers/${d.id}`}>{tCommon("view")}</Link>
                    </Button>
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

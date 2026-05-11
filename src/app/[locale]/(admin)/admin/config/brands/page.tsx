import { getTranslations } from "next-intl/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function AdminBrandsPage() {
  const supabase = await createServerSupabaseClient();
  const t = await getTranslations("Nav");
  const tCommon = await getTranslations("Common");

  const { data: brands } = await supabase
    .from("vehicle_brands")
    .select("*")
    .order("name", { ascending: true })
    .limit(500);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("adminBrands")}</h1>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/admin/config/models">{t("adminModels")}</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin/config/body-types">{t("adminBodyTypes")}</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin/config/provinces">{t("adminProvinces")}</Link>
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">{tCommon("name")}</th>
                <th className="px-4 py-3">Slug</th>
                <th className="px-4 py-3">{tCommon("status")}</th>
              </tr>
            </thead>
            <tbody>
              {(brands ?? []).map((b) => (
                <tr key={b.id} className="border-t border-border">
                  <td className="px-4 py-3 font-medium">{b.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{b.slug}</td>
                  <td className="px-4 py-3">
                    <Badge variant={b.is_active ? "success" : "secondary"}>
                      {b.is_active ? tCommon("active") : tCommon("inactive")}
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

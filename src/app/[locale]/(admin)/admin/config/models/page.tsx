import { getTranslations } from "next-intl/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function AdminModelsPage() {
  const supabase = await createServerSupabaseClient();
  const t = await getTranslations("Nav");
  const tCommon = await getTranslations("Common");

  const { data: models } = await supabase
    .from("vehicle_models")
    .select("id,name,slug,is_active,brand_id")
    .order("name", { ascending: true })
    .limit(2000);

  const { data: brands } = await supabase.from("vehicle_brands").select("id,name");
  const brandName = new Map((brands ?? []).map((b) => [b.id, b.name]));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("adminModels")}</h1>
        </div>
        <Button asChild variant="outline">
          <Link href="/admin/config/brands">{t("adminBrands")}</Link>
        </Button>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">{tCommon("name")}</th>
                <th className="px-4 py-3">Brand</th>
                <th className="px-4 py-3">{tCommon("status")}</th>
              </tr>
            </thead>
            <tbody>
              {(models ?? []).map((m) => (
                <tr key={m.id} className="border-t border-border">
                  <td className="px-4 py-3 font-medium">{m.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {brandName.get(m.brand_id) ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={m.is_active ? "success" : "secondary"}>
                      {m.is_active ? tCommon("active") : tCommon("inactive")}
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

import { getTranslations } from "next-intl/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { ReferenceEntityManager } from "@/modules/admin/components/config/reference-entity-manager";

export const dynamic = "force-dynamic";

export default async function AdminModelsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const supabase = await createServerSupabaseClient();
  const t = await getTranslations("Nav");
  const tAdmin = await getTranslations("Admin");

  const [{ data: models }, { data: brands }] = await Promise.all([
    supabase
      .from("vehicle_models")
      .select("id,name,slug,is_active,brand_id,created_at")
      .order("name", { ascending: true })
      .limit(2000),
    supabase.from("vehicle_brands").select("id,name").order("name", { ascending: true }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("adminModels")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{tAdmin("configTitle")}</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/admin/config/brands">{t("adminBrands")}</Link>
        </Button>
      </div>

      <ReferenceEntityManager
        kind="model"
        locale={locale}
        rows={models ?? []}
        brands={brands ?? []}
      />
    </div>
  );
}

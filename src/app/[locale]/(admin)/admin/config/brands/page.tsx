import { getTranslations } from "next-intl/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { ReferenceEntityManager } from "@/modules/admin/components/config/reference-entity-manager";

export const dynamic = "force-dynamic";

export default async function AdminBrandsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const supabase = await createServerSupabaseClient();
  const t = await getTranslations("Nav");
  const tAdmin = await getTranslations("Admin");

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
          <p className="mt-1 text-sm text-muted-foreground">{tAdmin("configTitle")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
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

      <ReferenceEntityManager kind="brand" locale={locale} rows={brands ?? []} />
    </div>
  );
}

import { getTranslations } from "next-intl/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { ReferenceEntityManager } from "@/modules/admin/components/config/reference-entity-manager";

export const dynamic = "force-dynamic";

export default async function AdminBodyTypesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const supabase = await createServerSupabaseClient();
  const t = await getTranslations("Nav");
  const tAdmin = await getTranslations("Admin");

  const { data: rows } = await supabase.from("body_types").select("*").order("name", { ascending: true });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("adminBodyTypes")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{tAdmin("configTitle")}</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/admin/config/brands">{t("adminBrands")}</Link>
        </Button>
      </div>

      <ReferenceEntityManager kind="body_type" locale={locale} rows={rows ?? []} />
    </div>
  );
}

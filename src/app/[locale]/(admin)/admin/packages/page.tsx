import { getTranslations } from "next-intl/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { DealerPackagesManager } from "@/modules/admin/components/dealer-packages-manager";

export const dynamic = "force-dynamic";

export default async function AdminPackagesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const supabase = await createServerSupabaseClient();
  const t = await getTranslations("Admin");
  const tPkg = await getTranslations("PackagesAdmin");

  const { data: packages } = await supabase
    .from("dealer_packages")
    .select("*")
    .order("price", { ascending: true });

  const { data: usage } = await supabase.from("dealer_subscriptions").select("package_id");

  const usageByPackageId: Record<string, number> = {};
  for (const row of usage ?? []) {
    usageByPackageId[row.package_id] = (usageByPackageId[row.package_id] ?? 0) + 1;
  }

  const rows = packages ?? [];

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">{t("packagesTitle")}</h1>
        <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">{tPkg("intro")}</p>
        <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">{tPkg("workflowNote")}</p>
      </div>

      <DealerPackagesManager locale={locale} rows={rows} usageByPackageId={usageByPackageId} />
    </div>
  );
}

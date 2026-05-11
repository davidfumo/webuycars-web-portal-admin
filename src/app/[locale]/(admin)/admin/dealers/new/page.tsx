import { getTranslations } from "next-intl/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NewDealerForm } from "@/modules/admin/components/new-dealer-form";

export const dynamic = "force-dynamic";

export default async function NewDealerPage() {
  const supabase = await createServerSupabaseClient();
  const t = await getTranslations("Admin");

  const [{ data: provinces }, { data: packages }] = await Promise.all([
    supabase.from("provinces").select("id,name").eq("is_active", true).order("name"),
    supabase
      .from("dealer_packages")
      .select("id,name,price,listing_limit,duration_days")
      .eq("is_active", true)
      .order("price"),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("dealerNew")}</h1>
      </div>
      <NewDealerForm provinces={provinces ?? []} packages={packages ?? []} />
    </div>
  );
}

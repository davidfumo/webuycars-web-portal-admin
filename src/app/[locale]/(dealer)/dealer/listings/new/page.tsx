import { getTranslations } from "next-intl/server";
import { getPortalContext } from "@/lib/auth/portal";
import { NewDealerListingForm } from "@/modules/dealer/components/new-dealer-listing-form";

export const dynamic = "force-dynamic";

export default async function NewDealerListingPage() {
  const ctx = await getPortalContext();
  const t = await getTranslations("Dealer");

  if (!ctx || ctx.surface !== "dealer") return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("listingNew")}</h1>
      </div>
      <NewDealerListingForm dealerId={ctx.dealerId} />
    </div>
  );
}

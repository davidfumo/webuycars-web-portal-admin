import { getTranslations } from "next-intl/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { publishListing, rejectListingFormAction } from "@/modules/admin/server/listing-moderation";

export const dynamic = "force-dynamic";

export default async function AdminListingsPage() {
  const supabase = await createServerSupabaseClient();
  const t = await getTranslations("Admin");
  const tCommon = await getTranslations("Common");

  const { data: rows } = await supabase
    .from("vehicle_listings")
    .select("id,title,status,created_at,dealer_id")
    .in("status", ["pending_review", "pending_payment", "draft"])
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("listingsTitle")}</h1>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">{tCommon("name")}</th>
                <th className="px-4 py-3">{tCommon("status")}</th>
                <th className="px-4 py-3">{tCommon("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {(rows ?? []).map((l) => (
                <tr key={l.id} className="border-t border-border">
                  <td className="px-4 py-3 font-medium">{l.title}</td>
                  <td className="px-4 py-3">{l.status}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      {l.status === "pending_review" ? (
                        <form action={publishListing.bind(null, l.id)}>
                          <Button type="submit" size="sm">
                            {t("listingApprove")}
                          </Button>
                        </form>
                      ) : null}
                      <form action={rejectListingFormAction} className="flex flex-wrap items-center gap-2">
                        <input type="hidden" name="listingId" value={l.id} />
                        <input
                          name="reason"
                          placeholder="Reason"
                          className="h-9 w-56 rounded-md border border-border bg-card px-2 text-sm"
                          required
                        />
                        <Button type="submit" size="sm" variant="destructive">
                          {t("listingReject")}
                        </Button>
                      </form>
                    </div>
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

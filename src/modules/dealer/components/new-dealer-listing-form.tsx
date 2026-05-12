"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingButton } from "@/components/ui/loading-button";
import { createDraftDealerListing } from "@/modules/dealer/server/listing-actions";
import type { DealerSubscriptionSummary } from "@/modules/dealer/types/subscription-summary";

type BillingChoice = "subscription_allowance" | "pay_per_listing";

type Props = {
  dealerId: string;
  subscription: DealerSubscriptionSummary | null;
  /** Latest row is still awaiting first subscription payment */
  subscriptionPendingPayment?: boolean;
  /** Non-active, non-pending status on latest row (e.g. suspended, expired) */
  subscriptionInactiveStatus?: string | null;
  /** Package name when subscription row exists but is not active */
  gatedPackageName?: string | null;
  referencePayPerListing: number;
  privatePlanCount: number;
};

export function NewDealerListingForm({
  dealerId,
  subscription,
  subscriptionPendingPayment = false,
  subscriptionInactiveStatus = null,
  gatedPackageName = null,
  referencePayPerListing,
  privatePlanCount,
}: Props) {
  const t = useTranslations("Dealer");
  const tList = useTranslations("Listing");
  const tBill = useTranslations("ListingBilling");
  const tCommon = useTranslations("Common");
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [pending, setPending] = useState(false);

  const defaultBilling: BillingChoice = useMemo(() => {
    if (subscription?.hasCapacity) return "subscription_allowance";
    return "pay_per_listing";
  }, [subscription]);

  const [billing, setBilling] = useState<BillingChoice>(defaultBilling);

  const canPickSubscription = Boolean(subscription?.hasCapacity);

  useEffect(() => {
    if (!canPickSubscription && billing === "subscription_allowance") {
      setBilling("pay_per_listing");
    }
  }, [canPickSubscription, billing]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    try {
      const result = await createDraftDealerListing({
        dealerId,
        title,
        billingMode: billing,
      });
      if (!result.ok) {
        if (result.code === "unauthorized") toast.error(tCommon("sessionExpired"));
        else if (result.code === "no_active_subscription") toast.error(tBill("noSubscriptionTitle"));
        else if (result.code === "subscription_pending_payment") {
          toast.error(tBill("pendingPaymentToast"));
        } else if (result.code === "subscription_full") {
          toast.error(tBill("subscriptionFull"));
        } else if (result.code === "invalid_title") {
          toast.error(tBill("titleRequired"));
        } else if (result.code === "persist_failed") {
          toast.error(tBill("persistFailed"));
        } else {
          toast.error(tCommon("error"));
        }
        return;
      }
      toast.success(tList("draftSaved"));
      router.replace("/dealer/listings");
      router.refresh();
    } catch {
      toast.error(tCommon("error"));
    } finally {
      setPending(false);
    }
  }

  const feeHint = subscription?.payPerExtra ?? referencePayPerListing;

  return (
    <div className="space-y-6">
      <Card className="max-w-xl border-border/80">
        <CardHeader>
          <CardTitle>{tBill("sectionTitle")}</CardTitle>
          <CardDescription>{tBill("sectionHint")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {subscription ? (
            <p className="text-sm text-muted-foreground">
              {tBill("capacity", {
                used: subscription.listingsUsed,
                limit: subscription.listingLimit,
                name: subscription.packageName,
              })}
            </p>
          ) : subscriptionPendingPayment ? (
            <div
              role="status"
              className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-muted-foreground"
            >
              <p className="font-medium text-foreground">{tBill("pendingPaymentTitle")}</p>
              <p className="mt-1">{tBill("pendingPaymentBody", { package: gatedPackageName ?? "—" })}</p>
              <Button asChild className="mt-3" size="sm" variant="secondary">
                <Link href="/dealer/subscription">{tBill("pendingPaymentCta")}</Link>
              </Button>
            </div>
          ) : subscriptionInactiveStatus ? (
            <div
              role="status"
              className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground"
            >
              <p className="font-medium text-foreground">{tBill("subscriptionInactiveTitle")}</p>
              <p className="mt-1">
                {tBill("subscriptionInactiveBody", {
                  status: subscriptionInactiveStatus,
                  package: gatedPackageName ?? "—",
                })}
              </p>
            </div>
          ) : (
            <div
              role="status"
              className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground"
            >
              <p className="font-medium text-foreground">{tBill("noSubscriptionTitle")}</p>
              <p className="mt-1">{tBill("noSubscriptionBody")}</p>
            </div>
          )}
          <p className="text-sm text-muted-foreground">
            {tBill("referenceFee", { amount: Number(feeHint).toLocaleString() })}
          </p>
          {privatePlanCount > 0 ? (
            <p className="text-xs text-muted-foreground">{tBill("privateCatalogNote", { count: privatePlanCount })}</p>
          ) : null}

          <div className="grid gap-3 pt-1 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => canPickSubscription && setBilling("subscription_allowance")}
              disabled={!canPickSubscription}
              className={`rounded-lg border p-4 text-left text-sm transition-colors ${
                billing === "subscription_allowance"
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "border-border hover:bg-muted/40"
              } ${!canPickSubscription ? "cursor-not-allowed opacity-60" : ""}`}
            >
              <div className="font-semibold text-foreground">{tBill("optionSubscriptionTitle")}</div>
              <p className="mt-2 text-muted-foreground">{tBill("optionSubscriptionBody")}</p>
            </button>
            <button
              type="button"
              onClick={() => setBilling("pay_per_listing")}
              className={`rounded-lg border p-4 text-left text-sm transition-colors ${
                billing === "pay_per_listing"
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "border-border hover:bg-muted/40"
              }`}
            >
              <div className="font-semibold text-foreground">{tBill("optionPayPerTitle")}</div>
              <p className="mt-2 text-muted-foreground">{tBill("optionPayPerBody")}</p>
            </button>
          </div>
        </CardContent>
      </Card>

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>{t("listingDetailsTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="title">{tCommon("name")}</Label>
              <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
            </div>
            <div className="flex gap-2">
              <LoadingButton type="submit" loading={pending}>
                {tList("saveDraft")}
              </LoadingButton>
              <Button type="button" variant="outline" onClick={() => router.back()} disabled={pending}>
                {tCommon("cancel")}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

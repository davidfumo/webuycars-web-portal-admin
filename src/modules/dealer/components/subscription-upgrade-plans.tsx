"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { computeSubscriptionUpgradeQuote } from "@/lib/dealer/compute-upgrade-quote";
import { createSubscriptionUpgradePayment } from "@/modules/dealer/server/subscription-upgrade-actions";
import { startPaysuiteSubscriptionCheckout } from "@/modules/dealer/lib/start-paysuite-subscription-checkout";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/loading-button";
import { Badge } from "@/components/ui/badge";
import type { PaymentMethod } from "@/lib/database.types";

export type UpgradePackageDTO = {
  id: string;
  name: string;
  slug: string;
  listing_limit: number;
  price: number;
  price_per_extra_listing: number;
};

export type UpgradeSubDTO = {
  package_id: string;
  listings_used: number;
  started_at: string | null;
  expires_at: string | null;
  status: string;
};

type Props = {
  dealerId: string;
  isManager: boolean;
  currentPackage: UpgradePackageDTO;
  subscription: UpgradeSubDTO;
  packages: UpgradePackageDTO[];
  pendingUpgrade: { id: string; amount: number; target_package_id: string | null } | null;
};

export function SubscriptionUpgradePlans({
  dealerId,
  isManager,
  currentPackage,
  subscription,
  packages,
  pendingUpgrade,
}: Props) {
  const t = useTranslations("Dealer");
  const tPay = useTranslations("Payment");
  const tCommon = useTranslations("Common");
  const locale = useLocale();
  const router = useRouter();

  const [selectedId, setSelectedId] = useState<string | null>(
    pendingUpgrade?.target_package_id ?? null,
  );
  const [paymentId, setPaymentId] = useState<string | null>(pendingUpgrade?.id ?? null);
  const [method, setMethod] = useState<PaymentMethod>("mpesa");
  const [busy, setBusy] = useState(false);

  const effectiveTargetId = selectedId ?? pendingUpgrade?.target_package_id ?? null;
  const selectedPkg = packages.find((p) => p.id === effectiveTargetId) ?? null;

  const quote = useMemo(() => {
    if (!selectedPkg || selectedPkg.id === currentPackage.id) return null;
    const now = Date.now();
    return computeSubscriptionUpgradeQuote({
      currentPackagePrice: Number(currentPackage.price),
      targetPackagePrice: Number(selectedPkg.price),
      listingLimit: currentPackage.listing_limit,
      listingsUsed: subscription.listings_used ?? 0,
      periodStartMs: subscription.started_at ? Date.parse(subscription.started_at) : null,
      periodEndMs: subscription.expires_at ? Date.parse(subscription.expires_at) : null,
      nowMs: now,
    });
  }, [selectedPkg, currentPackage, subscription]);

  const canUpgradeFlow = subscription.status === "active" && isManager;

  async function confirmUpgrade() {
    if (!selectedPkg || selectedPkg.id === currentPackage.id) return;
    setBusy(true);
    try {
      const { paymentId: pid } = await createSubscriptionUpgradePayment({
        dealerId,
        targetPackageId: selectedPkg.id,
      });
      setPaymentId(pid);
      toast.success(t("upgradePaymentCreated"));
      router.refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      const map: Record<string, string> = {
        forbidden: t("upgradeErrForbidden"),
        subscription_not_active: t("upgradeErrNotActive"),
        already_on_package: t("upgradeErrSamePlan"),
        package_not_found: t("upgradeErrPackage"),
        not_an_upgrade: t("upgradeErrNotHigher"),
      };
      toast.error(map[msg] ?? t("stepFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function pay() {
    if (!paymentId) return;
    setBusy(true);
    try {
      const result = await startPaysuiteSubscriptionCheckout({
        paymentId,
        method,
        locale,
      });
      if ("alreadyPaid" in result) {
        toast.success(tPay("returnSuccess"));
        router.replace("/dealer/dashboard");
        router.refresh();
        return;
      }
      window.location.assign(result.checkoutUrl);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === "paysuite_not_configured") {
        toast.error(tPay("paysuiteNotConfigured"));
      } else {
        toast.error(t("stepFailed"));
      }
    } finally {
      setBusy(false);
    }
  }

  if (!canUpgradeFlow) {
    return (
      <div className="rounded-xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
        {subscription.status !== "active" ? t("upgradeOnlyWhenActive") : t("upgradeManagerOnly")}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{t("upgrade")}</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t("upgradeIntro")}</p>
      </div>

      {paymentId && selectedPkg ? (
        <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-4 shadow-sm">
          <p className="text-sm font-medium text-foreground">{t("upgradeResumeTitle")}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("upgradeResumeBody", {
              plan: selectedPkg.name,
              amount: (pendingUpgrade?.amount ?? quote?.amountMzn ?? 0).toLocaleString(),
              currency: tCommon("currency"),
            })}
          </p>
        </div>
      ) : null}

      {!paymentId ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {packages.map((p) => {
            const isCurrent = p.id === currentPackage.id;
            const isHigher = Number(p.price) > Number(currentPackage.price);
            const isSelectable = !isCurrent && isHigher;
            const isSelected = selectedId === p.id;

            return (
              <button
                key={p.id}
                type="button"
                disabled={!isSelectable}
                aria-pressed={isSelected && isSelectable}
                onClick={() => isSelectable && setSelectedId(p.id)}
                className={cn(
                  "group relative flex flex-col rounded-xl border-2 bg-card p-4 text-left shadow-sm transition-all outline-none",
                  "hover:shadow-md focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                  isSelected &&
                    isSelectable &&
                    "border-primary shadow-md ring-2 ring-primary/25 ring-offset-2 ring-offset-background",
                  !isSelected && isSelectable && "border-border hover:border-primary/40",
                  isCurrent && "cursor-default border-muted bg-muted/25",
                  !isSelectable && !isCurrent && "cursor-not-allowed border-dashed border-muted opacity-60",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-semibold text-foreground">{p.name}</span>
                  {isCurrent ? (
                    <Badge variant="secondary" className="shrink-0">
                      {t("upgradeCurrentBadge")}
                    </Badge>
                  ) : isSelected ? (
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
                      <Check className="h-4 w-4" aria-hidden />
                    </span>
                  ) : (
                    <span className="h-8 w-8 shrink-0 rounded-full border-2 border-muted-foreground/25 bg-background" />
                  )}
                </div>
                <div className="mt-3 space-y-2 text-sm">
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">{t("upgradeListingsLabel")}</span>
                    <span className="font-medium tabular-nums">{p.listing_limit}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">{tCommon("currency")}</span>
                    <span className="font-medium tabular-nums">{Number(p.price).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between gap-2 text-xs text-muted-foreground">
                    <span>{t("upgradeExtraListing")}</span>
                    <span className="tabular-nums">{Number(p.price_per_extra_listing).toLocaleString()}</span>
                  </div>
                </div>
                {!isCurrent && !isHigher ? (
                  <p className="mt-3 text-xs text-muted-foreground">{t("upgradeLowerTierHint")}</p>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}

      {!paymentId && quote && selectedPkg ? (
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <h3 className="text-sm font-semibold">{t("upgradeQuoteTitle")}</h3>
          <ul className="mt-3 space-y-2 text-sm">
            <li className="flex justify-between gap-4">
              <span className="text-muted-foreground">{t("upgradeCatalogPrice")}</span>
              <span className="tabular-nums line-through decoration-muted-foreground">
                {quote.fullCatalogPrice.toLocaleString()} {tCommon("currency")}
              </span>
            </li>
            <li className="flex justify-between gap-4">
              <span className="text-muted-foreground">{t("upgradeDelta")}</span>
              <span className="tabular-nums">{quote.priceDelta.toLocaleString()} {tCommon("currency")}</span>
            </li>
            <li className="flex justify-between gap-4 text-xs text-muted-foreground">
              <span>{t("upgradeTimeFactor", { pct: Math.round(quote.timeProrationFactor * 100) })}</span>
              <span>{t("upgradeCapacityFactor", { pct: Math.round(quote.capacityFactor * 100) })}</span>
            </li>
            <li className="flex justify-between gap-4 border-t border-border pt-2 text-base font-semibold">
              <span>{t("upgradeYouPay")}</span>
              <span className="tabular-nums text-primary">
                {quote.amountMzn.toLocaleString()} {tCommon("currency")}
              </span>
            </li>
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">{t("upgradeQuoteFootnote")}</p>
          <LoadingButton type="button" className="mt-4" variant="default" loading={busy} onClick={confirmUpgrade}>
            {t("upgradeConfirmPlan")}
          </LoadingButton>
        </div>
      ) : null}

      {paymentId ? (
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <h3 className="text-sm font-semibold">{t("upgradeCheckoutTitle")}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{t("upgradeCheckoutHint")}</p>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {(["mpesa", "emola", "card"] as const).map((m) => (
              <Button
                key={m}
                type="button"
                variant="outline"
                size="sm"
                className={cn(
                  method === m &&
                    "border-black bg-black text-white shadow-none hover:bg-zinc-900 hover:text-white",
                )}
                onClick={() => setMethod(m)}
                disabled={busy}
              >
                {tPay(`method_${m}`)}
              </Button>
            ))}
          </div>
          <LoadingButton type="button" className="mt-4" variant="default" loading={busy} onClick={pay}>
            {tPay("continueToCheckout")}
          </LoadingButton>
        </div>
      ) : null}
    </div>
  );
}

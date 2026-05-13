"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/loading-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { createSubscriptionCheckoutPayment } from "@/modules/dealer/server/onboarding-actions";
import { startPaysuiteSubscriptionCheckout } from "@/modules/dealer/lib/start-paysuite-subscription-checkout";
import type { PaymentMethod } from "@/lib/database.types";

type Props = {
  dealerId: string;
  /** Pass the pre-created pending payment ID (from admin provisioning) to skip the "Generate" step. */
  existingPaymentId?: string | null;
  packageName: string;
  packagePrice: number;
  currency?: string;
};

/**
 * Self-contained card that lets a dealer manager pay a pending subscription from
 * any page (subscription page, dashboard banner, etc.) — not just the onboarding wizard.
 */
export function PayPendingSubscription({
  dealerId,
  existingPaymentId,
  packageName,
  packagePrice,
  currency = "MZN",
}: Props) {
  const t = useTranslations("Dealer");
  const tPay = useTranslations("Payment");
  const router = useRouter();
  const locale = useLocale();

  const [method, setMethod] = useState<PaymentMethod>("mpesa");
  const [paymentId, setPaymentId] = useState<string | null>(existingPaymentId ?? null);
  const [pending, setPending] = useState(false);

  async function generate() {
    setPending(true);
    try {
      const { paymentId: id } = await createSubscriptionCheckoutPayment({ dealerId, method });
      setPaymentId(id);
      toast.success(t("onboardingPaymentReady"));
    } catch {
      toast.error(t("stepFailed"));
    } finally {
      setPending(false);
    }
  }

  async function pay() {
    if (!paymentId) return;
    setPending(true);
    try {
      const result = await startPaysuiteSubscriptionCheckout({
        paymentId,
        method,
        locale,
      });
      if ("alreadyPaid" in result) {
        toast.success(t("onboardingComplete"));
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
        toast.error(msg === "payment_not_found" ? tPay("errorNotFound") : t("stepFailed"));
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="border-warning/60 bg-warning/5">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-warning" aria-hidden />
          <CardTitle className="text-base">{tPay("pendingTitle")}</CardTitle>
        </div>
        <CardDescription>
          {tPay("pendingBody", { package: packageName, price: Number(packagePrice).toLocaleString(), currency })}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
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
              disabled={pending}
            >
              {tPay(`method_${m}`)}
            </Button>
          ))}
        </div>

        {!paymentId ? (
          <LoadingButton type="button" variant="default" onClick={generate} loading={pending}>
            {tPay("generatePayment")}
          </LoadingButton>
        ) : (
          <LoadingButton type="button" variant="default" onClick={pay} loading={pending}>
            {tPay("continueToCheckout")}
          </LoadingButton>
        )}
      </CardContent>
    </Card>
  );
}

"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/loading-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  createSubscriptionCheckoutPayment,
  completeSubscriptionPayment,
} from "@/modules/dealer/server/onboarding-actions";
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
  const tCommon = useTranslations("Common");
  const router = useRouter();

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
      await completeSubscriptionPayment({ paymentId, dealerId, markOnboardingDone: true });
      toast.success(t("onboardingComplete"));
      router.replace("/dealer/dashboard");
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg === "payment not found" ? tPay("errorNotFound") : t("stepFailed"));
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
              variant={method === m ? "default" : "outline"}
              size="sm"
              onClick={() => setMethod(m)}
              disabled={pending || !!paymentId}
            >
              {tPay(`method_${m}`)}
            </Button>
          ))}
        </div>

        {!paymentId ? (
          <LoadingButton type="button" onClick={generate} loading={pending}>
            {tPay("generatePayment")}
          </LoadingButton>
        ) : (
          <div className="flex items-center gap-3">
            <LoadingButton type="button" onClick={pay} loading={pending}>
              {tPay("completeSimulated")}
            </LoadingButton>
            <span className="text-xs text-muted-foreground">{tCommon("required")}: {method}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

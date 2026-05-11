"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/loading-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  completeOnboardingPayment,
  createSubscriptionCheckoutPayment,
  saveOnboardingDealer,
  saveOnboardingProfile,
} from "@/modules/dealer/server/onboarding-actions";
import type { Database } from "@/lib/database.types";

type DealerRow = Database["public"]["Tables"]["dealers"]["Row"];
type PackageRow = Database["public"]["Tables"]["dealer_packages"]["Row"];

type Props = {
  dealer: DealerRow;
  pkg: PackageRow;
  initialFullName?: string | null;
};

export function OnboardingWizard({ dealer, pkg, initialFullName }: Props) {
  const t = useTranslations("Dealer");
  const tCommon = useTranslations("Common");
  const tPay = useTranslations("Payment");
  const router = useRouter();

  const [step, setStep] = useState(0);
  const [fullName, setFullName] = useState(initialFullName ?? "");
  const [businessName, setBusinessName] = useState(dealer.business_name);
  const [address, setAddress] = useState(dealer.address ?? "");
  const [method, setMethod] = useState<"mpesa" | "emola" | "card">("mpesa");
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const steps = useMemo(
    () => [t("stepProfile"), t("stepDealer"), t("stepPackage"), t("stepPayment")],
    [t],
  );

  async function nextFromProfile() {
    setPending(true);
    try {
      await saveOnboardingProfile({ fullName });
      setStep(1);
    } catch {
      toast.error(t("stepFailed"));
    } finally {
      setPending(false);
    }
  }

  async function nextFromDealer() {
    setPending(true);
    try {
      await saveOnboardingDealer({
        dealerId: dealer.id,
        businessName,
        address,
      });
      setStep(2);
    } catch {
      toast.error(t("stepFailed"));
    } finally {
      setPending(false);
    }
  }

  async function nextFromPackage() {
    setStep(3);
  }

  async function createPayment() {
    setPending(true);
    try {
      const { paymentId: id } = await createSubscriptionCheckoutPayment({
        dealerId: dealer.id,
        method,
      });
      setPaymentId(id);
      toast.success(t("onboardingPaymentReady"));
    } catch {
      toast.error(t("stepFailed"));
    } finally {
      setPending(false);
    }
  }

  async function payAndFinish() {
    if (!paymentId) return;
    setPending(true);
    try {
      await completeOnboardingPayment(paymentId);
      toast.success(t("onboardingComplete"));
      router.replace("/dealer/dashboard");
      router.refresh();
    } catch {
      toast.error(t("stepFailed"));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("onboardingTitle")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("stepProfile")} → {t("stepDealer")} → {t("stepPackage")} → {t("stepPayment")}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {steps.map((label, idx) => (
          <Badge key={label} variant={idx === step ? "default" : "secondary"}>
            {idx + 1}. {label}
          </Badge>
        ))}
      </div>

      {step === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("stepProfile")}</CardTitle>
            <CardDescription>{tCommon("required")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">{tCommon("name")}</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>
            <LoadingButton
              type="button"
              onClick={nextFromProfile}
              loading={pending}
              disabled={!fullName.trim()}
            >
              {tCommon("next")}
            </LoadingButton>
          </CardContent>
        </Card>
      ) : null}

      {step === 1 ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("stepDealer")}</CardTitle>
            <CardDescription>{tCommon("required")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="businessName">{tCommon("name")}</Label>
              <Input
                id="businessName"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">{tCommon("address")}</Label>
              <Input
                id="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(0)} disabled={pending}>
                {tCommon("back")}
              </Button>
              <LoadingButton
                type="button"
                onClick={nextFromDealer}
                loading={pending}
                disabled={!businessName.trim()}
              >
                {tCommon("next")}
              </LoadingButton>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step === 2 ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("stepPackage")}</CardTitle>
            <CardDescription>{t("subscriptionCurrent")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-border bg-muted/40 p-4">
              <div className="text-lg font-semibold">{pkg.name}</div>
              <Separator className="my-3" />
              <div className="grid gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("listingsUsed")}</span>
                  <span>0 / {pkg.listing_limit}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{tCommon("currency")}</span>
                  <span>
                    {Number(pkg.price).toLocaleString()} {tCommon("currency")}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{pkg.slug}</span>
                  <span>{pkg.duration_days}d</span>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)} disabled={pending}>
                {tCommon("back")}
              </Button>
              <Button onClick={nextFromPackage} disabled={pending}>
                {tCommon("next")}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step === 3 ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("stepPayment")}</CardTitle>
            <CardDescription>{tPay("simulatePay")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2 md:grid-cols-3">
              {(["mpesa", "emola", "card"] as const).map((m) => (
                <Button
                  key={m}
                  type="button"
                  variant={method === m ? "default" : "outline"}
                  onClick={() => setMethod(m)}
                  disabled={pending}
                >
                  {tPay(`method_${m}`)}
                </Button>
              ))}
            </div>
            {!paymentId ? (
              <LoadingButton type="button" onClick={createPayment} loading={pending}>
                {tPay("generatePayment")}
              </LoadingButton>
            ) : (
              <LoadingButton type="button" onClick={payAndFinish} loading={pending}>
                {tPay("completeSimulated")}
              </LoadingButton>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(2)} disabled={pending}>
                {tCommon("back")}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

    </div>
  );
}

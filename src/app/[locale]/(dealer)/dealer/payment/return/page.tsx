import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getPortalContext } from "@/lib/auth/portal";
import { finalizePaysuiteSubscriptionReturn } from "@/lib/payments/finalize-paysuite-subscription-return.server";
import { DEALER_DASHBOARD_SUBSCRIPTION_PAID_QUERY } from "@/lib/payments/subscription-paid-success-query";
import { PaymentReturnPolling } from "@/modules/dealer/components/payment-return-polling";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function DealerPaymentReturnPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{ paymentId?: string }>;
}) {
  const { locale } = await params;
  const ctx = await getPortalContext();
  const tPay = await getTranslations("Payment");

  if (!ctx || ctx.surface !== "dealer") return null;

  const sp = searchParams ? await searchParams : {};
  const paymentId = sp.paymentId?.trim() ?? "";

  if (!uuidRe.test(paymentId)) {
    return (
      <div className="mx-auto max-w-lg p-6">
        <Card>
          <CardHeader>
            <CardTitle>{tPay("returnInvalid")}</CardTitle>
            <CardDescription>{tPay("returnInvalidHint")}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const outcome = await finalizePaysuiteSubscriptionReturn({
    paymentId,
    dealerId: ctx.dealerId,
    userId: ctx.userId,
    staffRole: ctx.staff?.role ?? "",
  });

  if (outcome.kind === "redirect_dashboard") {
    redirect(`/${locale}/dealer/dashboard?${DEALER_DASHBOARD_SUBSCRIPTION_PAID_QUERY}`);
  }

  if (outcome.kind === "invalid") {
    return (
      <div className="mx-auto max-w-lg p-6">
        <Card>
          <CardHeader>
            <CardTitle>{tPay("returnForbidden")}</CardTitle>
            <CardDescription>{tPay("returnForbiddenHint")}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg p-6">
      <PaymentReturnPolling paymentId={paymentId} />
    </div>
  );
}

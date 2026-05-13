import { getTranslations } from "next-intl/server";
import { getPortalContext } from "@/lib/auth/portal";
import { PaymentReturnPolling } from "@/modules/dealer/components/payment-return-polling";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function DealerPaymentReturnPage({
  searchParams,
}: {
  searchParams?: Promise<{ paymentId?: string }>;
}) {
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

  return (
    <div className="mx-auto max-w-lg p-6">
      <PaymentReturnPolling paymentId={paymentId} />
    </div>
  );
}

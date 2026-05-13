"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const POLL_MS = 2500;
const MAX_POLLS = 48;

type Props = {
  paymentId: string;
};

export function PaymentReturnPolling({ paymentId }: Props) {
  const t = useTranslations("Payment");
  const router = useRouter();
  const [status, setStatus] = useState<"polling" | "paid" | "pending" | "error">("polling");
  const redirectedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let count = 0;
    const timerRef: { current: ReturnType<typeof setInterval> | undefined } = { current: undefined };

    const tick = async () => {
      if (cancelled || redirectedRef.current) return;
      count += 1;
      try {
        const res = await fetch("/api/payments/paysuite/sync", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paymentId }),
        });
        const data = (await res.json().catch(() => ({}))) as { status?: string };
        if (cancelled) return;
        if (data.status === "paid") {
          redirectedRef.current = true;
          setStatus("paid");
          toast.success(t("returnSuccess"));
          router.replace("/dealer/dashboard");
          router.refresh();
          if (timerRef.current) clearInterval(timerRef.current);
          return;
        }
        if (count >= MAX_POLLS) {
          setStatus("pending");
          if (timerRef.current) clearInterval(timerRef.current);
        }
      } catch {
        if (cancelled) return;
        setStatus("error");
        if (timerRef.current) clearInterval(timerRef.current);
      }
    };

    void tick();
    timerRef.current = setInterval(tick, POLL_MS);
    return () => {
      cancelled = true;
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- poll only when paymentId changes
  }, [paymentId]);

  return (
    <Card className="mx-auto max-w-lg">
      <CardHeader>
        <CardTitle>{t("returnTitle")}</CardTitle>
        <CardDescription>
          {status === "polling" ? t("returnPolling") : null}
          {status === "pending" ? t("returnStillPending") : null}
          {status === "error" ? t("returnError") : null}
          {status === "paid" ? t("returnRedirecting") : null}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {status === "pending" || status === "error" ? (
          <Button type="button" variant="outline" onClick={() => router.replace("/dealer/subscription")}>
            {t("returnBackToSubscription")}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

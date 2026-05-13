/**
 * Client-side: starts PaySuite hosted checkout for a pending subscription payment.
 * Same-origin `fetch` sends the Supabase session cookie set by the web app.
 */
export async function startPaysuiteSubscriptionCheckout(input: {
  paymentId: string;
  method: "mpesa" | "emola" | "card";
  locale: string;
}): Promise<{ checkoutUrl: string } | { alreadyPaid: true }> {
  const res = await fetch("/api/payments/paysuite/subscription-checkout", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      paymentId: input.paymentId,
      method: input.method,
      locale: input.locale,
    }),
  });

  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const err = typeof data.error === "string" ? data.error : "checkout_failed";
    throw new Error(err);
  }
  if (data.alreadyPaid === true) {
    return { alreadyPaid: true };
  }
  const checkoutUrl = data.checkoutUrl;
  if (typeof checkoutUrl !== "string" || !checkoutUrl) {
    throw new Error("no_checkout_url");
  }
  return { checkoutUrl };
}

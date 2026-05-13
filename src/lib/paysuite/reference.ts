/**
 * PaySuite `reference` max 50 characters; must be unique per payment intent.
 */
export function paysuiteReferenceForPayment(paymentId: string): string {
  const compact = paymentId.replace(/-/g, "");
  const ref = `WBC${compact}`;
  return ref.length <= 50 ? ref : ref.slice(0, 50);
}

import { createHmac, timingSafeEqual } from "crypto";

/**
 * Verifies `X-Webhook-Signature` per PaySuite docs (HMAC-SHA256 over raw body).
 */
export function verifyPaysuiteWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
): boolean {
  if (!secret || !signatureHeader) return false;
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  try {
    const a = Buffer.from(signatureHeader, "utf8");
    const b = Buffer.from(expected, "utf8");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

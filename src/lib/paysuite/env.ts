/**
 * PaySuite merchant API (https://paysuite.tech/docs).
 * Token and webhook secret come from the merchant dashboard.
 */
export type PaysuiteEnv = {
  apiBaseUrl: string;
  apiToken: string;
  webhookSecret: string;
};

export function getPaysuiteEnv(): PaysuiteEnv | null {
  const apiToken =
    process.env.PAYSUITE_API_TOKEN?.trim() ||
    process.env.PAYSUITE_TOKEN?.trim() ||
    "";
  const webhookSecret =
    process.env.PAYSUITE_WEBHOOK_SECRET?.trim() ||
    process.env.WEBHOOK_SECRET?.trim() ||
    "";
  const apiBaseUrl =
    process.env.PAYSUITE_API_BASE_URL?.trim() || "https://paysuite.tech";

  if (!apiToken) return null;
  return { apiBaseUrl: apiBaseUrl.replace(/\/$/, ""), apiToken, webhookSecret };
}

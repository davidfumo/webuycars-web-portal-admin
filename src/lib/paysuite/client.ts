import type { PaysuiteEnv } from "@/lib/paysuite/env";

export type PaysuiteCreatePaymentBody = {
  amount: string;
  reference: string;
  description?: string;
  return_url?: string;
  callback_url?: string;
  /** PaySuite: mpesa | emola | credit_card */
  method?: "mpesa" | "emola" | "credit_card";
};

export type PaysuitePaymentResponse = {
  id: string;
  amount: number;
  reference: string;
  status: string;
  /** Some PaySuite responses use this instead of `status`. */
  payment_status?: string;
  state?: string;
  checkout_url?: string;
  transaction?: {
    id?: number | string;
    status?: string;
    transaction_id?: string;
    paid_at?: string;
  };
};

type ApiSuccess<T> = { status: "success"; data: T };
type ApiError = { status: "error"; message: string };

function authHeaders(env: PaysuiteEnv) {
  return {
    Authorization: `Bearer ${env.apiToken}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };
}

export async function paysuiteCreatePayment(
  env: PaysuiteEnv,
  body: PaysuiteCreatePaymentBody,
): Promise<PaysuitePaymentResponse> {
  const url = `${env.apiBaseUrl}/api/v1/payments`;
  const res = await fetch(url, {
    method: "POST",
    headers: authHeaders(env),
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as ApiSuccess<PaysuitePaymentResponse> | ApiError;
  if (!res.ok || json.status !== "success" || !("data" in json)) {
    const msg = "message" in json ? json.message : `HTTP ${res.status}`;
    throw new Error(msg || "paysuite_create_failed");
  }
  return json.data;
}

export async function paysuiteGetPayment(
  env: PaysuiteEnv,
  paysuitePaymentId: string,
): Promise<PaysuitePaymentResponse> {
  const url = `${env.apiBaseUrl}/api/v1/payments/${encodeURIComponent(paysuitePaymentId)}`;
  const res = await fetch(url, {
    method: "GET",
    headers: authHeaders(env),
  });
  const json = (await res.json()) as ApiSuccess<PaysuitePaymentResponse> | ApiError;
  if (!res.ok || json.status !== "success" || !("data" in json)) {
    const msg = "message" in json ? json.message : `HTTP ${res.status}`;
    throw new Error(msg || "paysuite_get_failed");
  }
  return json.data;
}

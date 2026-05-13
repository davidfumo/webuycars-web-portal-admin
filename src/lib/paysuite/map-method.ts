import type { PaymentMethod } from "@/lib/database.types";

/** Map app enum to PaySuite API `method` field. */
export function toPaysuiteMethod(method: PaymentMethod): "mpesa" | "emola" | "credit_card" {
  if (method === "mpesa") return "mpesa";
  if (method === "emola") return "emola";
  return "credit_card";
}

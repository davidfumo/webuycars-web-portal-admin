export type UpgradeQuoteInput = {
  currentPackagePrice: number;
  targetPackagePrice: number;
  listingLimit: number;
  listingsUsed: number;
  /** Subscription period bounds (ms since epoch). */
  periodStartMs: number | null;
  periodEndMs: number | null;
  nowMs: number;
};

export type UpgradeQuote = {
  /** Integer MZN to charge via PaySuite */
  amountMzn: number;
  fullCatalogPrice: number;
  priceDelta: number;
  /** 0–1 share of remaining subscription time */
  timeProrationFactor: number;
  /** 0.25–1; lower when many listing slots are unused */
  capacityFactor: number;
};

/**
 * Fair upgrade charge (not full target catalog price):
 * - Base: difference vs current plan.
 * - Time: prorated by remaining time in the current billing window.
 * - Capacity: if the dealer is under-using their listing allowance, reduce the charge
 *   (floored at 25% of the prorated delta so upgrades are never literally free).
 */
export function computeSubscriptionUpgradeQuote(input: UpgradeQuoteInput): UpgradeQuote {
  const full = Math.max(0, Number(input.targetPackagePrice));
  const delta = Math.max(0, Number(input.targetPackagePrice) - Number(input.currentPackagePrice));

  let timeF = 1;
  if (
    input.periodEndMs != null &&
    input.periodStartMs != null &&
    input.periodEndMs > input.periodStartMs
  ) {
    const total = input.periodEndMs - input.periodStartMs;
    const remaining = Math.max(0, input.periodEndMs - input.nowMs);
    timeF = Math.min(1, Math.max(0, remaining / total));
  }

  const limit = Math.max(1, Math.floor(input.listingLimit));
  const used = Math.max(0, Math.floor(input.listingsUsed));
  const util = Math.min(1, used / limit);
  const capacityF = Math.max(0.25, util);

  const raw = delta * timeF * capacityF;
  const amountMzn = Math.max(1, Math.round(raw));

  return {
    amountMzn,
    fullCatalogPrice: full,
    priceDelta: delta,
    timeProrationFactor: timeF,
    capacityFactor: capacityF,
  };
}

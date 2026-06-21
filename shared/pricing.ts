// Daily Close per-store pricing — SINGLE SOURCE OF TRUTH.
//
// Graduated tiered pricing: each store is billed at the rate for its tier, so
// the rate per store drops as an owner grows (and no one is ever "punished" at
// the bottom of a bucket). These tiers MUST mirror the Stripe graduated Price
// the checkout uses (see docs go-live runbook) — change them in lockstep.
//
//   store 1        $29   ("$1 a day" anchor)
//   stores 2–5     $24 each
//   stores 6–15    $19 each
//   stores 16+     $14 each
//
// Examples: 1=$29 · 4=$101 · 5=$125 · 6=$144 · 10=$220 · 16=$329

export interface PriceTier {
  /** Inclusive upper bound of this tier (store count). null = unbounded (16+). */
  upTo: number | null;
  /** Per-store price within this tier, in cents. */
  unitCents: number;
}

export const PRICE_TIERS: PriceTier[] = [
  { upTo: 1, unitCents: 2900 },
  { upTo: 5, unitCents: 2400 },
  { upTo: 15, unitCents: 1900 },
  { upTo: null, unitCents: 1400 }
];

/** Total monthly price (cents) for a given number of billed stores. */
export function monthlyPriceCents(storeCount: number): number {
  const n = Math.max(0, Math.floor(storeCount));
  if (n === 0) return 0;
  let total = 0;
  let prev = 0;
  for (const tier of PRICE_TIERS) {
    const cap = tier.upTo ?? Infinity;
    const inThisTier = Math.max(0, Math.min(n, cap) - prev);
    total += inThisTier * tier.unitCents;
    prev = cap;
    if (n <= cap) break;
  }
  return total;
}

/** Blended price per store (cents), rounded — for "≈ $X each" displays. */
export function effectivePerStoreCents(storeCount: number): number {
  const n = Math.max(1, Math.floor(storeCount));
  return Math.round(monthlyPriceCents(n) / n);
}

export interface Plan {
  key: "solo" | "multi" | "growth" | "chain";
  name: string;
  /** Inclusive store-count range. maxStores null = unbounded (16+). */
  minStores: number;
  maxStores: number | null;
  /** Marketing tagline. */
  who: string;
}

export const PLANS: Plan[] = [
  { key: "solo", name: "Solo", minStores: 1, maxStores: 1, who: "For a single shop." },
  { key: "multi", name: "Multi", minStores: 2, maxStores: 5, who: "For owners with a few shops." },
  { key: "growth", name: "Growth", minStores: 6, maxStores: 15, who: "For a growing group of stores." },
  { key: "chain", name: "Chain", minStores: 16, maxStores: null, who: "For large & franchise operators." }
];

/** Which named plan a store count falls into. */
export function planForStoreCount(storeCount: number): Plan {
  const n = Math.max(1, Math.floor(storeCount));
  return (
    PLANS.find((p) => n >= p.minStores && (p.maxStores === null || n <= p.maxStores)) ??
    PLANS[PLANS.length - 1]
  );
}

/** The "from" price (cents) for a plan — its lowest store count. */
export function planFromCents(plan: Plan): number {
  return monthlyPriceCents(plan.minStores);
}

/** Plans at/above this store count are quoted "Custom" rather than a fixed price. */
export const CUSTOM_FROM_STORES = 16;

/** Format cents as USD, dropping the decimals on whole-dollar amounts. */
export function formatUsd(cents: number): string {
  const dollars = cents / 100;
  return `$${dollars % 1 === 0 ? dollars.toFixed(0) : dollars.toFixed(2)}`;
}

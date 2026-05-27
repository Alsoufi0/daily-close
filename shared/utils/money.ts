/**
 * Format a number as USD with whole-dollar precision.
 * Used for headline numbers on dashboards where cents are visual clutter.
 *
 * NOTE: rounds to whole dollars. Do NOT use for the close shortage/over
 * difference — a -$0.27 shortage would round to "-$0" and look like the
 * register matched when it didn't. Use formatMoneyExact for those.
 */
export function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value);
}

/**
 * Same as formatMoney but always shows cents (2 decimal places).
 * Use anywhere precision matters — the cash-shortage card, the close
 * difference, audit log displays, anything an employee will compare
 * line-by-line against a POS receipt.
 */
export function formatMoneyExact(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

/**
 * Parse a money-ish string into a number, robust against the things
 * users actually type or paste:
 *   - thousands separators ("1,169" → 1169)
 *   - currency symbols ("$1169" → 1169)
 *   - stray whitespace and non-breaking spaces (Android keyboards
 *     occasionally insert these as group separators — they parse as
 *     NaN under bare `Number()`)
 *   - empty / undefined / whitespace-only → 0
 *
 * Returns 0 on parse failure instead of NaN so callers don't need to
 * NaN-check downstream — a parse failure shouldn't break the close
 * math by poisoning every subsequent computation.
 */
export function toMoney(value: string | number | undefined | null): number {
  if (value === undefined || value === null) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  // Strip everything except digits, decimal point, and leading minus sign.
  // Non-breaking space ( ) and narrow nbsp ( ) are explicitly
  // covered by the negated char class since they aren't ASCII whitespace.
  const cleaned = value.replace(/[^\d.\-]/g, "");
  if (!cleaned || cleaned === "-" || cleaned === ".") return 0;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

export function getDifferenceTone(value: number): "good" | "bad" | "neutral" {
  if (value < 0) return "bad";
  if (value > 0) return "good";
  return "neutral";
}

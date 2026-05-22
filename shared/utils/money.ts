export function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value);
}

export function getDifferenceTone(value: number): "good" | "bad" | "neutral" {
  if (value < 0) return "bad";
  if (value > 0) return "good";
  return "neutral";
}

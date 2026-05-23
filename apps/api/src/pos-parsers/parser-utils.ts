/**
 * Find the dollar amount associated with one of several label aliases in an
 * OCR-extracted receipt. Receipts vary wildly: the value can be on the same
 * line as the label, on the next line, separated by spaces, or surrounded by
 * extra characters. OCR also commonly confuses O/0, S/5, I/1, l/1, B/8 and
 * may produce stray punctuation. We accept those letters inside the amount
 * and translate them back to digits during parse.
 */
export function readMoney(text: string, labels: string[]): number {
  if (!text) return 0;
  const flattened = text.replace(/[ \t]+/g, " ");
  // Digit-or-confusable token used inside the amount capture.
  const D = "[\\d.,OoIlSB]";
  // Capture every "$1,234.56" / "1234.56" / "260" candidate after the label, so
  // we can prefer money-looking values (with $ or decimal) over bare integer
  // counts that may sit between the label and the actual amount.
  // Example: "Gross Sales 260 $3,704.91" → pick 3704.91, not 260.
  const candidateGlobal = new RegExp(`(\\$)?\\s*\\(?(-?${D}+)\\)?`, "g");

  for (const label of labels) {
    const labelPattern = label.replace(/\s+/g, "\\s+");

    // 1) Same line: scan everything after the label on that line, gather all
    // numeric candidates, and pick the best money-shaped one.
    const sameLine = new RegExp(`${labelPattern}\\s*[:\\-=]?\\s*([^\\n]*)`, "i");
    const sameMatch = flattened.match(sameLine);
    if (sameMatch) {
      const picked = pickBestMoney(sameMatch[1] ?? "", candidateGlobal);
      if (picked !== null) return picked;
    }

    // 2) Label and value on subsequent lines: "TOTAL SALES\n$5,550.00"
    const multiLine = new RegExp(`${labelPattern}[^\\n]*\\n+\\s*([^\\n]*)`, "i");
    const multiMatch = flattened.match(multiLine);
    if (multiMatch) {
      const picked = pickBestMoney(multiMatch[1] ?? "", candidateGlobal);
      if (picked !== null) return picked;
    }
  }

  return 0;
}

function pickBestMoney(segment: string, candidateGlobal: RegExp): number | null {
  candidateGlobal.lastIndex = 0;
  const candidates: { value: number; hasDollar: boolean; hasDecimal: boolean }[] = [];
  let m: RegExpExecArray | null;
  while ((m = candidateGlobal.exec(segment)) !== null) {
    const raw = m[2];
    const value = parseMoneyToken(raw);
    if (value === null) continue;
    candidates.push({
      value,
      hasDollar: Boolean(m[1]),
      hasDecimal: /\./.test(raw)
    });
  }
  if (candidates.length === 0) return null;
  // Prefer $-prefixed, then decimal-containing, then fall back to the first.
  const dollar = candidates.find((c) => c.hasDollar);
  if (dollar) return dollar.value;
  const decimal = candidates.find((c) => c.hasDecimal);
  if (decimal) return decimal.value;
  return candidates[0].value;
}

function parseMoneyToken(raw: string | undefined): number | null {
  if (!raw) return null;

  // Reject anything that doesn't contain at least one real digit — that
  // stops us from misreading label words like "Sales" as a number.
  if (!/\d/.test(raw)) return null;

  // Translate digit-confused letters anywhere in the captured token, then
  // strip thousand separators and any trailing punctuation.
  const repaired = raw.replace(/[OoIlSB]/g, (ch) => ocrDigitFor(ch));
  const cleaned = repaired.replace(/,/g, "").replace(/\.+$/, "");

  if (!/^\-?\d+(\.\d+)?$/.test(cleaned)) return null;
  const value = Number(cleaned);
  if (Number.isNaN(value)) return null;
  if (value > 1_000_000 || value < -1_000_000) return null;
  return value;
}

function ocrDigitFor(ch: string): string {
  switch (ch) {
    case "O":
    case "o":
      return "0";
    case "I":
    case "l":
      return "1";
    case "S":
      return "5";
    case "B":
      return "8";
    default:
      return ch;
  }
}

export function confidenceFrom(values: number[]): number {
  const found = values.filter((value) => value > 0).length;
  return Number((found / values.length).toFixed(2));
}

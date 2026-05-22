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

  for (const label of labels) {
    const labelPattern = label.replace(/\s+/g, "\\s+");

    // 1) Same line: "Cash Sales $2,430.00" / "CASH 2430.00" / "Total: 5550"
    const sameLine = new RegExp(
      `${labelPattern}\\s*[:\\-=]?\\s*\\$?\\s*\\(?(-?${D}+)\\)?`,
      "i"
    );
    const sameMatch = flattened.match(sameLine);
    const sameAmount = parseMoneyToken(sameMatch?.[1]);
    if (sameAmount !== null) return sameAmount;

    // 2) Label and value on subsequent lines: "TOTAL SALES\n$5,550.00"
    const multiLine = new RegExp(
      `${labelPattern}[^\\d\\$\\n]*\\n+\\s*\\$?\\s*\\(?(-?${D}+)\\)?`,
      "i"
    );
    const multiMatch = flattened.match(multiLine);
    const multiAmount = parseMoneyToken(multiMatch?.[1]);
    if (multiAmount !== null) return multiAmount;
  }

  return 0;
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

import type { ParsedPOSReport } from "@shared/types";
import { confidenceFrom, readMoney } from "./parser-utils";
import { POSParser } from "./pos-parser.interface";

type TerminalTableValues = {
  cashSales: number;
  cardSales: number;
  totalSales: number;
  taxableProductSales: number;
  tax: number;
  refunds: number;
  discounts: number;
};

/**
 * Generic paper terminal/Z report parser. This covers receipt-style reports
 * like "Terminal Reports" where sales, cash, credit/debit, taxes, refunds and
 * discounts are printed in aligned columns instead of Clover/NRS-specific text.
 */
export class TerminalReportParser implements POSParser {
  readonly type = "TERMINAL_REPORT" as const;

  canParse(text: string): boolean {
    return /terminal\s+reports|gross\s+sales|credit\s*\/\s*debit|taxes\s+and\s+fees|collection\s+summary/i.test(text);
  }

  parse(text: string): ParsedPOSReport {
    const tableValues = this.parseTableRowFallback(text);
    const cashSales = readMoney(text, [
      "cash",
      "cash payments"
    ]) || tableValues.cashSales;
    const cardSales = readMoney(text, [
      "credit/debit",
      "credit / debit",
      "credit debit",
      "card",
      "credit",
      "debit"
    ]) || tableValues.cardSales;
    const grossSales = readMoney(text, [
      "gross sales",
      "total sales",
      "net sales"
    ]) || tableValues.totalSales;
    const taxableProductSales = readMoney(text, [
      "taxable product sales",
      "product sales"
    ]) || tableValues.taxableProductSales;
    const tax = readMoney(text, [
      "sales tax (tax)",
      "tax (tax)",
      "sales tax",
      "tax"
    ]) || tableValues.tax;
    const refunds = readMoney(text, ["refunds", "refund"]) || tableValues.refunds;
    const discounts = readMoney(text, [
      "store discounts",
      "in store discounts",
      "discounts",
      "discount"
    ]) || tableValues.discounts;

    return {
      parserType: this.type,
      cashSales,
      cardSales,
      totalSales: grossSales || taxableProductSales || cashSales + cardSales,
      tax,
      refunds,
      discounts,
      confidence: confidenceFrom([cashSales, cardSales, grossSales || taxableProductSales])
    };
  }

  private parseTableRowFallback(text: string): TerminalTableValues {
    const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const moneyLine = lines.find((line) => this.moneyTokens(line).length >= 8);
    if (!moneyLine) return this.emptyTableValues();

    const values = this.moneyTokens(moneyLine);
    const lower = text.toLowerCase();
    const labels = [
      "taxable product sales",
      "taxable other sales",
      "total tax and fees",
      "non-taxable product sale",
      "non-taxable other sales",
      "gpi",
      "gross sales",
      "cash",
      "check",
      "credit/debit",
      "vendor payouts",
      "safe drops",
      "taxable sales",
      "sales tax (tax)",
      "refunds",
      "in store promos",
      "in store discounts"
    ]
      .map((label) => ({ label, index: lower.indexOf(label) }))
      .filter((entry) => entry.index >= 0)
      .sort((a, b) => a.index - b.index);

    const byLabel = new Map<string, number>();
    labels.forEach((entry, index) => {
      if (values[index] !== undefined && !byLabel.has(entry.label)) {
        byLabel.set(entry.label, values[index]);
      }
    });

    return {
      cashSales: byLabel.get("cash") || 0,
      cardSales: byLabel.get("credit/debit") || 0,
      totalSales: byLabel.get("gross sales") || 0,
      taxableProductSales: byLabel.get("taxable product sales") || 0,
      tax: byLabel.get("sales tax (tax)") || byLabel.get("total tax and fees") || 0,
      refunds: byLabel.get("refunds") || 0,
      discounts: byLabel.get("in store discounts") || 0
    };
  }

  private emptyTableValues(): TerminalTableValues {
    return {
      cashSales: 0,
      cardSales: 0,
      totalSales: 0,
      taxableProductSales: 0,
      tax: 0,
      refunds: 0,
      discounts: 0
    };
  }

  private moneyTokens(line: string): number[] {
    return Array.from(line.matchAll(/\$?\s*(-?\d{1,3}(?:,\d{3})*(?:\.\d{2}))/g))
      .map((match) => Number((match[1] || "").replace(/,/g, "")))
      .filter((value) => Number.isFinite(value));
  }
}

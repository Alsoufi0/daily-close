import type { ParsedPOSReport } from "@shared/types";
import { confidenceFrom, readMoney } from "./parser-utils";
import { POSParser } from "./pos-parser.interface";

export class NRSParser implements POSParser {
  readonly type = "NRS" as const;

  canParse(text: string): boolean {
    return /national retail solutions|\bnrs\b|nrs pos|z report|x report|register close|day close|shift close|smoke shop|tobacco/i.test(
      text
    );
  }

  parse(text: string): ParsedPOSReport {
    const cashSales = readMoney(text, [
      "cash sales",
      "cash tender",
      "cash received",
      "tender cash",
      "cash"
    ]);
    const cardSales = readMoney(text, [
      "credit card sales",
      "card sales",
      "credit card",
      "card tender",
      "credit tender",
      "debit",
      "cc total",
      "cards",
      "card"
    ]);
    const totalSales = readMoney(text, [
      "net sales",
      "total sales",
      "gross sales",
      "sales total",
      "net total",
      "grand total",
      "total"
    ]);
    const tax = readMoney(text, ["sales tax", "tax collected", "tax total", "taxes", "tax"]);
    const refunds = readMoney(text, ["refund total", "refunds", "returns", "refund"]);
    const discounts = readMoney(text, ["discount total", "discounts", "discount"]);
    const lottery = readMoney(text, ["lottery payout", "lottery"]);

    return {
      parserType: this.type,
      cashSales,
      cardSales,
      totalSales: totalSales || cashSales + cardSales,
      tax,
      refunds,
      discounts,
      lottery,
      confidence: confidenceFrom([cashSales, cardSales, totalSales])
    };
  }
}

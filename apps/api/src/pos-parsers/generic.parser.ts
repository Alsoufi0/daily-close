import type { ParsedPOSReport } from "@shared/types";
import { confidenceFrom, readMoney } from "./parser-utils";
import { POSParser } from "./pos-parser.interface";

/**
 * Last-resort parser. Matches any receipt that has a dollar amount and a
 * label that hints at a total/sale/cash/card. Returns whatever it can find.
 */
export class GenericParser implements POSParser {
  readonly type = "UNKNOWN" as const;

  canParse(text: string): boolean {
    if (!text) return false;
    return /total|sales|cash|card|tax/i.test(text);
  }

  parse(text: string): ParsedPOSReport {
    const cashSales = readMoney(text, ["cash sales", "cash tender", "cash"]);
    const cardSales = readMoney(text, ["card sales", "credit card", "card", "credit", "debit"]);
    const totalSales = readMoney(text, [
      "gross sales",
      "total sales",
      "net sales",
      "grand total",
      "total"
    ]);
    const tax = readMoney(text, ["sales tax (tax)", "tax (tax)", "sales tax", "tax"]);
    const refunds = readMoney(text, ["refunds", "refund", "returns"]);
    const discounts = readMoney(text, ["discounts", "discount"]);

    return {
      parserType: this.type,
      cashSales,
      cardSales,
      totalSales: totalSales || cashSales + cardSales,
      tax,
      refunds,
      discounts,
      confidence: confidenceFrom([cashSales, cardSales, totalSales])
    };
  }
}

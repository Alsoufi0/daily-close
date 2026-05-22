import type { ParsedPOSReport } from "@shared/types";
import { confidenceFrom, readMoney } from "./parser-utils";
import { POSParser } from "./pos-parser.interface";

export class NRSParser implements POSParser {
  readonly type = "NRS" as const;

  canParse(text: string): boolean {
    return /national retail solutions|nrs|z report|register close/i.test(text);
  }

  parse(text: string): ParsedPOSReport {
    const cashSales = readMoney(text, ["cash tender", "cash", "cash sale"]);
    const cardSales = readMoney(text, ["card tender", "credit", "debit", "card"]);
    const totalSales = readMoney(text, ["total sale", "total sales", "net total"]);
    const tax = readMoney(text, ["tax collected", "tax"]);
    const refunds = readMoney(text, ["refund", "refunds"]);
    const discounts = readMoney(text, ["discount", "discounts"]);
    const lottery = readMoney(text, ["lottery"]);

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

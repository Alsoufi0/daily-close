import type { ParsedPOSReport } from "@shared/types";
import { confidenceFrom, readMoney } from "./parser-utils";
import { POSParser } from "./pos-parser.interface";

export class CloverParser implements POSParser {
  readonly type = "CLOVER" as const;

  canParse(text: string): boolean {
    return /clover|payments summary|tender summary/i.test(text);
  }

  parse(text: string): ParsedPOSReport {
    const cashSales = readMoney(text, ["cash", "cash sales"]);
    const cardSales = readMoney(text, ["credit card", "card", "card sales"]);
    const totalSales = readMoney(text, ["net sales", "total sales", "gross sales", "total"]);
    const tax = readMoney(text, ["tax", "sales tax"]);
    const refunds = readMoney(text, ["refunds", "returns"]);
    const discounts = readMoney(text, ["discounts"]);

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

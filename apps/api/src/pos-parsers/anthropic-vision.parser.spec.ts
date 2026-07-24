import { AnthropicVisionParser } from "./anthropic-vision.parser";
import { PosParserService } from "./pos-parser.service";

describe("AnthropicVisionParser (via PosParserService)", () => {
  const service = new PosParserService();
  const parser = new AnthropicVisionParser();

  const envelope = (fields: Record<string, unknown>) =>
    JSON.stringify({ _extractor: "anthropic-vision", ...fields });

  it("maps a Clover vision envelope, summing debit + credit into cardSales", () => {
    const result = service.parse(
      envelope({
        format: "clover",
        grossSales: 991.13,
        netSales: 986.13,
        cashSales: 296.6,
        debitCardSales: 689.2,
        creditCardSales: 71.82,
        cardSalesTotal: 761.02,
        tax: 71.49,
        refunds: 0,
        discounts: 5.0,
        amountCollected: 1057.62,
        confidence: 0.97
      })
    );

    expect(result.parserType).toBe("CLOVER");
    expect(result.cashSales).toBe(296.6);
    expect(result.cardSales).toBe(761.02);
    expect(result.totalSales).toBe(991.13);
    expect(result.tax).toBe(71.49);
    expect(result.discounts).toBe(5.0);
    expect(result.confidence).toBe(0.97);
  });

  it("falls back to debit+credit when cardSalesTotal is missing", () => {
    const result = service.parse(
      envelope({ format: "clover", debitCardSales: 611.1, creditCardSales: 138.29, grossSales: 890.59, cashSales: 205.7 })
    );
    expect(result.cardSales).toBeCloseTo(749.39, 2);
  });

  it("maps an NRS/terminal envelope to TERMINAL_REPORT", () => {
    const result = service.parse(
      envelope({ format: "nrs_terminal", grossSales: 3085.49, cashSales: 1073.18, cardSalesTotal: 2012.31, tax: 201.59 })
    );
    expect(result.parserType).toBe("TERMINAL_REPORT");
    expect(result.cardSales).toBe(2012.31);
    expect(result.totalSales).toBe(3085.49);
  });

  it("does not claim ordinary OCR text (regex parsers still run)", () => {
    const result = service.parse(`
      Clover Payments Summary
      Cash Sales $2,430.00
      Card Sales $3,120.00
      Total Sales $5,550.00
    `);
    expect(result.parserType).toBe("CLOVER");
    expect(result.cashSales).toBe(2430);
  });

  it("only claims JSON tagged with its extractor id", () => {
    // Untagged JSON, or plain OCR text, must not be claimed by the vision parser.
    expect(parser.canParse(JSON.stringify({ format: "clover", cashSales: 100 }))).toBe(false);
    expect(parser.canParse("Cash Sales $2,430.00")).toBe(false);
    expect(parser.canParse(envelope({ format: "clover", cashSales: 100 }))).toBe(true);
  });
});

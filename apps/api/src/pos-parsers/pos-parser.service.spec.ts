import { PosParserService } from "./pos-parser.service";

describe("PosParserService", () => {
  const service = new PosParserService();

  it("parses Clover sales totals", () => {
    const result = service.parse(`
      Clover Payments Summary
      Cash Sales $2,430.00
      Card Sales $3,120.00
      Tax $412.00
      Refunds $0.00
      Discounts $35.00
      Total Sales $5,550.00
    `);

    expect(result.parserType).toBe("CLOVER");
    expect(result.cashSales).toBe(2430);
    expect(result.cardSales).toBe(3120);
    expect(result.totalSales).toBe(5550);
  });

  it("parses NRS sales totals", () => {
    const result = service.parse(`
      NRS Z Report
      Cash Tender $1,500.00
      Card Tender $2,400.00
      Tax Collected $290.00
      Total Sales $3,900.00
      Lottery $120.00
    `);

    expect(result.parserType).toBe("NRS");
    expect(result.cashSales).toBe(1500);
    expect(result.cardSales).toBe(2400);
    expect(result.totalSales).toBe(3900);
    expect(result.lottery).toBe(120);
  });
});

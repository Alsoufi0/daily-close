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

  it("parses rotated terminal report OCR text like the uploaded smoke shop sample", () => {
    const result = service.parse(`
      Smokers World 4
      Terminal Reports
      04/28/2026 10:45 PM to 04/29/2026 10:45 PM

      Sales
      Taxable Product Sales        $3,381.57
      Taxable Other Sales          $0.00
      Total Tax and Fees           $242.36
      Non-Taxable Product Sale     $0.00
      Non-Taxable Other Sales      $0.00
      GPI                          $86.59
      Gross Sales             260  $3,704.91
      Cash                         $1,169.27
      Check                        $0.00
      Credit/Debit                 $2,535.64

      Payout and Drops
      Vendor Payouts               $0.00
      Safe Drops                   $1,086.00

      Taxes And Fees Collection Summary
      Taxable Sales                $3,462.55
      Sales Tax (Tax)              $242.36

      Other Information
      Refunds                      $0.00
      In Store Promos              $0.00
      In Store Discounts           $0.00
      GPI                          $86.59
    `);

    expect(result.parserType).toBe("TERMINAL_REPORT");
    expect(result.cashSales).toBe(1169.27);
    expect(result.cardSales).toBe(2535.64);
    expect(result.totalSales).toBe(3704.91);
    expect(result.tax).toBe(242.36);
    expect(result.refunds).toBe(0);
    expect(result.discounts).toBe(0);
  });

  it("parses terminal report values when OCR puts labels and values on nearby lines", () => {
    const result = service.parse(`
      Terminal Reports
      Sales
      Gross Sales
      260
      $3,704.91
      Cash
      $1,169.27
      Credit/Debit
      $2,535.64
      Sales Tax (Tax)
      $242.36
      Refunds
      $0.00
      Store Discounts
      $0.00
    `);

    expect(result.cashSales).toBe(1169.27);
    expect(result.cardSales).toBe(2535.64);
    expect(result.totalSales).toBe(3704.91);
    expect(result.tax).toBe(242.36);
  });

  it("parses OCR.space table output from the uploaded terminal report photo", () => {
    const result = service.parse(`
      $3,381.57 $0.00 $242.36 $0.00 $0.00 $86.59 $3,704.91 $1,169.27 $0.00 $2,535.64 $0.00 $1,086.00 $3,462.55 $242.36 $0.00 $0.00 $0.00 $86.59
      260
      Smokers World 4 5724 E W.T. Harris Blvd Charlotte, NC 28215 04/28/2026 10:45 PM to 04/29/2026 10:45 PM Taxes And Fees Collection Summary
      Terminal Reports Sales Taxable Product Sales Taxable Other Sales Total Tax and Fees Non-Taxable Product Sale Non-Taxable Other Sales GPI Gross Sales Cash Check Credit/Debit Payout and Drops Vendor Payouts Safe Drops Cashbacks Taxable Sales Sales Tax (Tax) Other Information Refunds In Store Promos In Store Discounts GPI
    `);

    expect(result.parserType).toBe("TERMINAL_REPORT");
    expect(result.cashSales).toBe(1169.27);
    expect(result.cardSales).toBe(2535.64);
    expect(result.totalSales).toBe(3704.91);
    expect(result.tax).toBe(242.36);
    expect(result.refunds).toBe(0);
    expect(result.discounts).toBe(0);
    expect(result.confidence).toBe(1);
  });
});

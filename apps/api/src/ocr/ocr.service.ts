import { Injectable } from "@nestjs/common";

export interface OCRService {
  extractText(fileUrl: string): Promise<string>;
}

@Injectable()
export class MockOCRService implements OCRService {
  async extractText(): Promise<string> {
    return [
      "Clover Payments Summary",
      "Cash Sales $2430.00",
      "Card Sales $3120.00",
      "Tax $412.00",
      "Refunds $0.00",
      "Discounts $35.00",
      "Total Sales $5550.00"
    ].join("\n");
  }
}

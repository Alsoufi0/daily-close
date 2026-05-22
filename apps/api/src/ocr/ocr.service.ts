import { Injectable } from "@nestjs/common";

export interface OCRService {
  extractText(fileUrl: string): Promise<string>;
}

/**
 * Returns sample Clover text — useful only in dev (OCR_MODE=demo).
 * Real OCR (Google Vision, AWS Textract, etc.) would replace this.
 */
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

/**
 * Default in production. Returns an empty body so the parser yields zeros and
 * the employee fills the numbers themselves from the uploaded photo.
 */
@Injectable()
export class ManualEntryOCRService implements OCRService {
  async extractText(): Promise<string> {
    return "";
  }
}

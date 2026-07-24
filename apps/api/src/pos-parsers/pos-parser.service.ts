import { Injectable } from "@nestjs/common";
import type { ParsedPOSReport } from "@shared/types";
import { AnthropicVisionParser } from "./anthropic-vision.parser";
import { CloverParser } from "./clover.parser";
import { GenericParser } from "./generic.parser";
import { NRSParser } from "./nrs.parser";
import { POSParser } from "./pos-parser.interface";
import { TerminalReportParser } from "./terminal-report.parser";

@Injectable()
export class PosParserService {
  private readonly parsers: POSParser[] = [
    // The vision extractor emits a tagged JSON envelope; claim it first. Only
    // matches that envelope, so the regex parsers below still handle raw OCR
    // text from OCR.space / Google Vision.
    new AnthropicVisionParser(),
    new CloverParser(),
    new NRSParser(),
    new TerminalReportParser(),
    new GenericParser()
  ];

  parse(text: string): ParsedPOSReport {
    if (!text || !text.trim()) {
      return {
        parserType: "UNKNOWN",
        cashSales: 0,
        cardSales: 0,
        totalSales: 0,
        tax: 0,
        refunds: 0,
        discounts: 0,
        confidence: 0
      };
    }
    const parser = this.parsers.find((candidate) => candidate.canParse(text));
    if (parser) return parser.parse(text);
    return new GenericParser().parse(text);
  }
}

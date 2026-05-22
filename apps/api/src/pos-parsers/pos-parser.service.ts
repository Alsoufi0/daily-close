import { Injectable } from "@nestjs/common";
import type { ParsedPOSReport } from "@shared/types";
import { CloverParser } from "./clover.parser";
import { GenericParser } from "./generic.parser";
import { NRSParser } from "./nrs.parser";
import { POSParser } from "./pos-parser.interface";

@Injectable()
export class PosParserService {
  private readonly parsers: POSParser[] = [
    new CloverParser(),
    new NRSParser(),
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

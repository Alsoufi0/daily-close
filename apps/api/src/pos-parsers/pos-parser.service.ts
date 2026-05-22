import { Injectable } from "@nestjs/common";
import type { ParsedPOSReport } from "@shared/types";
import { CloverParser } from "./clover.parser";
import { NRSParser } from "./nrs.parser";
import { POSParser } from "./pos-parser.interface";

@Injectable()
export class PosParserService {
  private readonly parsers: POSParser[] = [new CloverParser(), new NRSParser()];

  parse(text: string): ParsedPOSReport {
    const parser = this.parsers.find((candidate) => candidate.canParse(text));
    if (parser) return parser.parse(text);

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
}

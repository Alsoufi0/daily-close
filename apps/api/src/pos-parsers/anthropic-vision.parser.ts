import type { ParsedPOSReport } from "@shared/types";
import { POSParser } from "./pos-parser.interface";

/**
 * Maps the JSON envelope produced by AnthropicVisionOCRService into a
 * ParsedPOSReport. The vision model has already done the reading, the
 * debit+credit summing, and the layout/reconciliation work, so this parser is a
 * straight field mapping — no regex, no label matching.
 *
 * It only claims text that is our tagged JSON envelope; anything else falls
 * through to the regex parsers, so the OCR.space path keeps working unchanged.
 */
export class AnthropicVisionParser implements POSParser {
  readonly type = "CLOVER" as const; // nominal; real type is derived per-report in parse()

  canParse(text: string): boolean {
    const envelope = this.tryParse(text);
    return envelope?._extractor === "anthropic-vision";
  }

  parse(text: string): ParsedPOSReport {
    const e = this.tryParse(text) ?? {};

    const cashSales = num(e.cashSales);
    const cardSales = num(e.cardSalesTotal, num(e.debitCardSales) + num(e.creditCardSales));
    const grossSales = num(e.grossSales, num(e.netSales));
    const tax = num(e.tax);
    const refunds = num(e.refunds);
    const discounts = num(e.discounts);

    return {
      parserType: mapParserType(e.format),
      cashSales,
      cardSales,
      totalSales: grossSales || num(e.netSales) || cashSales + cardSales,
      tax,
      refunds,
      discounts,
      // Trust the model's own confidence, but never claim high confidence when
      // the core figures came back empty.
      confidence: clampConfidence(e.confidence, [cashSales, cardSales, grossSales])
    };
  }

  private tryParse(text: string): any | null {
    if (!text) return null;
    const trimmed = text.trim();
    if (!trimmed.startsWith("{")) return null;
    try {
      return JSON.parse(trimmed);
    } catch {
      return null;
    }
  }
}

function num(value: unknown, fallback = 0): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function mapParserType(format: unknown): ParsedPOSReport["parserType"] {
  switch (format) {
    case "clover":
      return "CLOVER";
    case "nrs_terminal":
      return "TERMINAL_REPORT";
    default:
      return "UNKNOWN";
  }
}

function clampConfidence(modelConfidence: unknown, coreValues: number[]): number {
  const found = coreValues.filter((v) => v > 0).length;
  const floor = Number((found / coreValues.length).toFixed(2));
  const model = typeof modelConfidence === "number" ? modelConfidence : NaN;
  if (!Number.isFinite(model)) return floor;
  // Cap the model's self-reported confidence by how many core figures we
  // actually got, so a confident-but-empty read can't score high.
  return Number(Math.min(Math.max(model, 0), 1, floor === 0 ? 0.34 : 1).toFixed(2));
}

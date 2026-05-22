import type { ParsedPOSReport } from "@shared/types";

export interface POSParser {
  readonly type: ParsedPOSReport["parserType"];
  canParse(text: string): boolean;
  parse(text: string): ParsedPOSReport;
}

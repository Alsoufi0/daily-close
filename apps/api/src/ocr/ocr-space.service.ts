import { Injectable, Logger } from "@nestjs/common";
import { OCRService } from "./ocr.service";

/**
 * Real OCR via api.ocr.space.
 *
 * Free tier: ~25k requests/month with a registered API key. The public
 * demo key 'helloworld' works out of the box but is rate-limited.
 * Get a real key at https://ocr.space/ocrapi/freekey
 *
 * Configured by env:
 *   OCR_MODE=ocrspace
 *   OCR_SPACE_API_KEY=<your key>     (defaults to "helloworld")
 *   OCR_SPACE_LANGUAGE=eng           (default)
 *   OCR_SPACE_ENGINE=2               (1 = fast, 2 = better numeric accuracy)
 */
@Injectable()
export class OcrSpaceOCRService implements OCRService {
  private readonly logger = new Logger(OcrSpaceOCRService.name);
  private readonly apiKey = process.env.OCR_SPACE_API_KEY || "helloworld";
  private readonly language = process.env.OCR_SPACE_LANGUAGE || "eng";
  private readonly engine = process.env.OCR_SPACE_ENGINE || "2";

  async extractText(fileUrl: string): Promise<string> {
    if (!fileUrl) return "";

    const params = new URLSearchParams({
      apikey: this.apiKey,
      url: fileUrl,
      language: this.language,
      OCREngine: this.engine,
      isTable: "true",
      scale: "true"
    });

    try {
      const res = await fetch("https://api.ocr.space/parse/image", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString()
      });
      const body = (await res.json()) as {
        ParsedResults?: Array<{ ParsedText?: string }>;
        OCRExitCode?: number;
        IsErroredOnProcessing?: boolean;
        ErrorMessage?: string | string[];
      };

      if (body.IsErroredOnProcessing) {
        const msg = Array.isArray(body.ErrorMessage)
          ? body.ErrorMessage.join("; ")
          : body.ErrorMessage || "Unknown OCR error";
        this.logger.warn(`OCR.space error: ${msg}`);
        return "";
      }

      const text = body.ParsedResults?.map((r) => r.ParsedText || "").join("\n") || "";
      this.logger.log(`OCR.space extracted ${text.length} chars from ${fileUrl}`);
      return text;
    } catch (err: any) {
      this.logger.error(`OCR.space request failed: ${err?.message || err}`);
      return "";
    }
  }
}

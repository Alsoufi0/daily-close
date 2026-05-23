import { Injectable, Logger } from "@nestjs/common";
import { makeOcrImageVariants, scoreReceiptText } from "./ocr-quality";
import { OcrSpaceOCRService } from "./ocr-space.service";
import { OCRService } from "./ocr.service";

/**
 * Real OCR via Google Cloud Vision (DOCUMENT_TEXT_DETECTION).
 *
 * Enable with:
 *   OCR_MODE=google
 *   GOOGLE_VISION_API_KEY=<api-key>
 */
@Injectable()
export class GoogleVisionOCRService implements OCRService {
  private readonly logger = new Logger(GoogleVisionOCRService.name);
  private readonly apiKey = process.env.GOOGLE_VISION_API_KEY || "";

  async extractText(fileUrl: string): Promise<string> {
    if (!fileUrl) return "";
    if (!this.apiKey) {
      this.logger.warn("GOOGLE_VISION_API_KEY missing - returning empty text");
      return "";
    }

    let variants: Awaited<ReturnType<typeof makeOcrImageVariants>>;
    try {
      variants = await makeOcrImageVariants(fileUrl);
    } catch (err: any) {
      this.logger.warn(`Vision could not fetch image: ${err?.message || err}`);
      return "";
    }

    let bestText = "";
    let bestScore = -1;

    for (const variant of variants) {
      try {
        const base64 = Buffer.from(await variant.blob.arrayBuffer()).toString("base64");
        const res = await fetch(
          `https://vision.googleapis.com/v1/images:annotate?key=${this.apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              requests: [
                {
                  image: { content: base64 },
                  features: [{ type: "DOCUMENT_TEXT_DETECTION" }]
                }
              ]
            })
          }
        );
        const body = (await res.json()) as {
          responses?: Array<{
            fullTextAnnotation?: { text?: string };
            error?: { message?: string };
          }>;
        };
        const first = body.responses?.[0];
        if (first?.error?.message) {
          this.logger.warn(`Vision error for ${variant.name}: ${first.error.message}`);
          continue;
        }

        const text = first?.fullTextAnnotation?.text || "";
        const score = scoreReceiptText(text);
        if (score > bestScore) {
          bestText = text;
          bestScore = score;
        }
        if (score >= 95) break;
      } catch (err: any) {
        this.logger.error(`Vision request failed for ${variant.name}: ${err?.message || err}`);
      }
    }

    if (bestScore < 40) {
      this.logger.warn(`Vision OCR quality was low (${bestScore}); trying OCR.space fallback`);
      const fallbackText = await new OcrSpaceOCRService().extractText(fileUrl);
      if (scoreReceiptText(fallbackText) > bestScore) {
        bestText = fallbackText;
        bestScore = scoreReceiptText(fallbackText);
      }
    }

    this.logger.log(`Vision extracted ${bestText.length} chars from ${fileUrl} with score ${bestScore}`);
    return bestText;
  }
}

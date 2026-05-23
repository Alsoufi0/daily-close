import { Injectable, Logger } from "@nestjs/common";
import { OCRService } from "./ocr.service";

/**
 * Real OCR via Google Cloud Vision (DOCUMENT_TEXT_DETECTION).
 *
 * Auth options (use whichever fits your hosting):
 *   GOOGLE_VISION_API_KEY=<api-key>        — simplest, restrict to Vision API
 *   GOOGLE_APPLICATION_CREDENTIALS=<path>  — service-account JSON path (uses
 *                                            the official @google-cloud/vision
 *                                            SDK; install separately).
 *
 * This implementation uses the API-key path so it has zero runtime deps
 * beyond `fetch` and works on Render/Fly/Vercel without a JSON keyfile.
 *
 * Enable with: OCR_MODE=google
 */
@Injectable()
export class GoogleVisionOCRService implements OCRService {
  private readonly logger = new Logger(GoogleVisionOCRService.name);
  private readonly apiKey = process.env.GOOGLE_VISION_API_KEY || "";

  async extractText(fileUrl: string): Promise<string> {
    if (!fileUrl) return "";
    if (!this.apiKey) {
      this.logger.warn("GOOGLE_VISION_API_KEY missing — returning empty text");
      return "";
    }

    // Vision wants base64 OR a GCS URI. Supabase URLs aren't GCS, so pull the
    // bytes and inline them.
    let base64: string;
    try {
      const res = await fetch(fileUrl);
      if (!res.ok) {
        this.logger.warn(`Vision fetch image failed: ${res.status}`);
        return "";
      }
      const buf = Buffer.from(await res.arrayBuffer());
      base64 = buf.toString("base64");
    } catch (err: any) {
      this.logger.warn(`Vision could not fetch image: ${err?.message || err}`);
      return "";
    }

    try {
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
        this.logger.warn(`Vision error: ${first.error.message}`);
        return "";
      }
      const text = first?.fullTextAnnotation?.text || "";
      this.logger.log(`Vision extracted ${text.length} chars from ${fileUrl}`);
      return text;
    } catch (err: any) {
      this.logger.error(`Vision request failed: ${err?.message || err}`);
      return "";
    }
  }
}

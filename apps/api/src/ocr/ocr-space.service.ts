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

    // OCR.space's URL-based fetcher is unreliable for Supabase signed URLs
    // (long query strings, geo restrictions). Always pull the bytes
    // ourselves and forward as multipart — that path is rock solid.
    let imageBlob: Blob;
    let fileName: string;
    try {
      const imgRes = await fetch(fileUrl);
      if (!imgRes.ok) {
        this.logger.warn(`OCR fetch image failed: ${imgRes.status}`);
        return "";
      }
      imageBlob = await imgRes.blob();
      fileName = `report.${this.detectFileType(fileUrl).toLowerCase()}`;
    } catch (err: any) {
      this.logger.warn(`OCR could not fetch image: ${err?.message || err}`);
      return "";
    }

    const form = new FormData();
    form.set("apikey", this.apiKey);
    form.set("language", this.language);
    form.set("OCREngine", this.engine);
    form.set("isTable", "true");
    form.set("scale", "true");
    form.set("file", imageBlob, fileName);

    try {
      const res = await fetch("https://api.ocr.space/parse/image", {
        method: "POST",
        body: form
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

  // OCR.space rejects URLs without an obvious extension - look at the path,
  // strip Supabase signed-URL query string first.
  private detectFileType(fileUrl: string): string {
    try {
      const path = new URL(fileUrl).pathname.toLowerCase();
      if (path.endsWith(".pdf")) return "PDF";
      if (path.endsWith(".png")) return "PNG";
      if (path.endsWith(".webp")) return "WEBP";
      if (path.endsWith(".gif")) return "GIF";
      if (path.endsWith(".bmp")) return "BMP";
      if (path.endsWith(".tif") || path.endsWith(".tiff")) return "TIF";
    } catch {
      /* fall through */
    }
    return "JPG"; // safe default for phone uploads
  }
}

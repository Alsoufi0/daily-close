import { Injectable, Logger } from "@nestjs/common";
import { makeOcrImageVariants, scoreReceiptText } from "./ocr-quality";
import { OCRService } from "./ocr.service";

/**
 * Real OCR via api.ocr.space.
 *
 * Free tier: ~25k requests/month with a registered API key. The public
 * demo key "helloworld" works out of the box but is rate-limited.
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

    let variants: Awaited<ReturnType<typeof makeOcrImageVariants>>;
    try {
      variants = await makeOcrImageVariants(fileUrl);
    } catch (err: any) {
      this.logger.warn(`OCR could not fetch image: ${err?.message || err}`);
      return "";
    }

    let bestText = "";
    let bestScore = -1;

    for (const variant of variants) {
      const form = new FormData();
      form.set("apikey", this.apiKey);
      form.set("language", this.language);
      form.set("OCREngine", this.engine);
      form.set("isTable", "true");
      form.set("scale", "true");
      form.set("file", variant.blob, this.fileNameForVariant(fileUrl, variant.name));

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
          this.logger.warn(`OCR.space error for ${variant.name}: ${msg}`);
          continue;
        }

        const text = body.ParsedResults?.map((r) => r.ParsedText || "").join("\n") || "";
        const score = scoreReceiptText(text);
        if (score > bestScore) {
          bestText = text;
          bestScore = score;
        }
        if (score >= 95) break;
      } catch (err: any) {
        this.logger.error(`OCR.space request failed for ${variant.name}: ${err?.message || err}`);
      }
    }

    this.logger.log(
      `OCR.space extracted ${bestText.length} chars from ${this.describeImageSource(fileUrl)} with score ${bestScore}`
    );
    return bestText;
  }

  private describeImageSource(fileUrl: string): string {
    if (fileUrl.startsWith("data:")) {
      const mediaType = fileUrl.slice(5, fileUrl.indexOf(";") > 0 ? fileUrl.indexOf(";") : 40);
      return `${mediaType || "data-url"} data URL (${fileUrl.length} chars)`;
    }
    try {
      const url = new URL(fileUrl);
      return `${url.protocol}//${url.host}${url.pathname}`;
    } catch {
      return fileUrl.length > 120 ? `${fileUrl.slice(0, 117)}...` : fileUrl;
    }
  }

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
    return "JPG";
  }

  private fileNameForVariant(fileUrl: string, variantName: string): string {
    const detectedType = this.detectFileType(fileUrl).toLowerCase();
    const extension = variantName === "original" ? detectedType : "jpg";
    return `report-${variantName}.${extension}`;
  }
}

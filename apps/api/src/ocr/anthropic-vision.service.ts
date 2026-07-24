import { Injectable, Logger } from "@nestjs/common";
import Anthropic from "@anthropic-ai/sdk";
import { OCRService } from "./ocr.service";

/**
 * Receipt OCR via a Claude vision call.
 *
 * Instead of running text OCR and then regex-parsing the result, this reads the
 * receipt photo directly into structured daily totals. It handles the things
 * that break text+regex on real employee photos: 90/180-degree rotation,
 * crumpled/curled paper, angled shots, busy backgrounds, and — most
 * importantly — perspective drift where the label column and value column no
 * longer line up row-for-row. It also sums Clover's separate Debit Card and
 * Credit Card tender lines into one card-sales figure, which the old parser
 * missed.
 *
 * Output contract: extractText() returns a JSON envelope string tagged with
 * `_extractor: "anthropic-vision"`. AnthropicVisionParser recognizes that tag
 * and maps it to a ParsedPOSReport, so the rest of the pipeline is unchanged.
 * On any failure it returns "" — the pipeline then yields zeros and the
 * employee enters the numbers by hand, exactly like the other providers.
 *
 * Configured by env:
 *   OCR_MODE=anthropic
 *   ANTHROPIC_API_KEY=<key>
 *   OCR_ANTHROPIC_MODEL=claude-opus-4-8   (default)
 */
@Injectable()
export class AnthropicVisionOCRService implements OCRService {
  private readonly logger = new Logger(AnthropicVisionOCRService.name);
  private readonly model = process.env.OCR_ANTHROPIC_MODEL || "claude-opus-4-8";
  private readonly client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY || ""
  });

  async extractText(fileUrl: string): Promise<string> {
    if (!fileUrl) return "";
    if (!process.env.ANTHROPIC_API_KEY) {
      this.logger.warn("ANTHROPIC_API_KEY is not set; vision OCR disabled");
      return "";
    }

    let image: { mediaType: string; data: string; isPdf: boolean };
    try {
      image = await this.loadImage(fileUrl);
    } catch (err: any) {
      this.logger.warn(`Vision OCR could not load image: ${err?.message || err}`);
      return "";
    }

    const source = image.isPdf
      ? { type: "document" as const, source: { type: "base64" as const, media_type: "application/pdf" as const, data: image.data } }
      : { type: "image" as const, source: { type: "base64" as const, media_type: image.mediaType as any, data: image.data } };

    try {
      const res = await this.client.messages.create({
        // Ceiling only (billed per token generated). Generous headroom so a
        // hard image's adaptive-thinking pass can't crowd out the JSON output.
        model: this.model,
        max_tokens: 8192,
        system: SYSTEM_PROMPT,
        thinking: { type: "adaptive" },
        output_config: { format: { type: "json_schema", schema: RECEIPT_SCHEMA } } as any,
        messages: [
          {
            role: "user",
            content: [
              source as any,
              { type: "text", text: "Extract the daily totals from this sales report." }
            ]
          }
        ]
      });

      const textBlock = res.content.find((b): b is Anthropic.TextBlock => b.type === "text");
      if (!textBlock) {
        this.logger.warn(`Vision OCR returned no text block (stop_reason=${res.stop_reason})`);
        return "";
      }

      // Validate it parses and tag it so the parser can claim it.
      const parsed = JSON.parse(textBlock.text);
      parsed._extractor = "anthropic-vision";
      this.logger.log(
        `Vision OCR read format=${parsed.format} gross=${parsed.grossSales} cash=${parsed.cashSales} card=${parsed.cardSalesTotal} tax=${parsed.tax} confidence=${parsed.confidence} tokens=${res.usage?.output_tokens ?? "?"}`
      );
      return JSON.stringify(parsed);
    } catch (err: any) {
      this.logger.error(`Vision OCR request failed: ${err?.message || err}`);
      return "";
    }
  }

  /**
   * Accepts a data: URL, an http(s) URL, or a bare base64 string, and returns
   * base64 bytes plus a media type. Image inputs are downscaled to a 1600px
   * long edge with sharp — receipts stay perfectly legible, payload stays under
   * the API's per-image limit, and image-token cost drops. PDFs pass through.
   */
  private async loadImage(fileUrl: string): Promise<{ mediaType: string; data: string; isPdf: boolean }> {
    let buffer: Buffer;
    let mediaType: string;

    if (fileUrl.startsWith("data:")) {
      const match = fileUrl.match(/^data:([^;,]+)?(;base64)?,(.*)$/s);
      if (!match) throw new Error("invalid data URL");
      mediaType = match[1] || "image/jpeg";
      const isBase64 = Boolean(match[2]);
      buffer = isBase64 ? Buffer.from(match[3] || "", "base64") : Buffer.from(decodeURIComponent(match[3] || ""));
    } else if (/^https?:\/\//i.test(fileUrl)) {
      const res = await fetch(fileUrl);
      if (!res.ok) throw new Error(`image fetch failed: ${res.status}`);
      mediaType = res.headers.get("content-type") || "image/jpeg";
      buffer = Buffer.from(await res.arrayBuffer());
    } else {
      // Assume a bare base64 payload (mobile clients send this without a prefix).
      buffer = Buffer.from(fileUrl, "base64");
      mediaType = "image/jpeg";
    }

    const isPdf = mediaType.includes("pdf");
    if (isPdf) {
      return { mediaType: "application/pdf", data: buffer.toString("base64"), isPdf: true };
    }

    // Downscale + normalize to JPEG. Vision does not need full phone resolution
    // and a smaller image is cheaper and safely under the size limit.
    try {
      const sharpModule = await import("sharp");
      const sharp = sharpModule.default;
      const normalized = await sharp(buffer)
        .rotate() // honor EXIF orientation if present
        .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 90, mozjpeg: true })
        .toBuffer();
      return { mediaType: "image/jpeg", data: normalized.toString("base64"), isPdf: false };
    } catch {
      // sharp failed (unsupported input) — send the original bytes as-is.
      const normalizedType = ["image/jpeg", "image/png", "image/gif", "image/webp"].includes(mediaType)
        ? mediaType
        : "image/jpeg";
      return { mediaType: normalizedType, data: buffer.toString("base64"), isPdf: false };
    }
  }
}

const SYSTEM_PROMPT = `You read a photo of a point-of-sale end-of-day sales report (a "Z report" / "Sales Overview" / "Terminal Report") and extract the daily totals as structured JSON.

These photos are taken by store employees on their phones. They may be rotated 90/180 degrees, crumpled, curled, shot at an angle, or lie on a busy background. Read the printed receipt regardless of orientation. If perspective makes the left label column and the right value column drift vertically relative to each other, pair each label with the value on its own printed row — reconcile using the receipt's own math (see rules).

Extract ONLY the store-level daily totals from the summary sections (e.g. "SALES SUMMARY", "SALES BY TENDER TYPE", "TOTAL CASH DEPOSIT", "Taxes And Fees Collection Summary"). NEVER take numbers from a per-employee breakdown ("SALES BY EMPLOYEES", a person's name like "Moe"/"Von") — those are a subset and will be wrong.

Field rules:
- cashSales: total cash sales (Clover "Cash (n)" tender line, or "Cash Sales"; NRS/Terminal "Cash").
- debitCardSales / creditCardSales: on Clover these are two separate tender lines ("Debit Card (n)" and "Credit Card (n)"). Read each.
- cardSalesTotal: total non-cash card sales = debitCardSales + creditCardSales. On an NRS/Terminal report with a single "Credit/Debit" line, cardSalesTotal is that line and debit/credit split is 0.
- grossSales: "Gross Sales" if present, else "Total Sales"/"Net Sales"/"Taxable Product Sales".
- netSales: "Net Sales" if present, else same as grossSales.
- tax: "Taxes & Fees" / "Sales Tax" / "Total Tax and Fees".
- discounts: shown like "Discounts (1)  ($5.00)" — return the positive magnitude (5.00). 0 if absent.
- refunds: 0 if absent.
- amountCollected: "Amount Collected" if present.
- reportDate: the report's business date if printed (YYYY-MM-DD), else "".

Reconciliation (use to self-check and fix column drift): cashSales + cardSalesTotal should equal amountCollected (tax-inclusive) when Amount Collected is present. If your first read doesn't reconcile, re-read the columns.

Return every monetary field as a plain number (dollars, no "$" or commas). Use 0 for anything genuinely absent from the report. Set confidence 0..1 for how sure you are of cashSales, cardSalesTotal, grossSales, and tax together.`;

const RECEIPT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    format: { type: "string", enum: ["clover", "nrs_terminal", "other"] },
    storeName: { type: "string" },
    reportDate: { type: "string" },
    grossSales: { type: "number" },
    netSales: { type: "number" },
    cashSales: { type: "number" },
    debitCardSales: { type: "number" },
    creditCardSales: { type: "number" },
    cardSalesTotal: { type: "number" },
    tax: { type: "number" },
    refunds: { type: "number" },
    discounts: { type: "number" },
    amountCollected: { type: "number" },
    confidence: { type: "number" }
  },
  required: [
    "format", "storeName", "reportDate", "grossSales", "netSales", "cashSales",
    "debitCardSales", "creditCardSales", "cardSalesTotal", "tax", "refunds",
    "discounts", "amountCollected", "confidence"
  ]
};

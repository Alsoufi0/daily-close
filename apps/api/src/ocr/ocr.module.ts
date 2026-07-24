import { Module, Type } from "@nestjs/common";
import { ManualEntryOCRService, MockOCRService } from "./ocr.service";
import { OcrSpaceOCRService } from "./ocr-space.service";
import { GoogleVisionOCRService } from "./google-vision.service";
import { AnthropicVisionOCRService } from "./anthropic-vision.service";

// Auto-detect provider when OCR_MODE is unset. Prefer the Claude vision reader
// when a key is present: it reads real employee photos (rotated, crumpled,
// angled, busy backgrounds, drifted columns) far more reliably than text OCR +
// regex, and sums Clover's split debit/credit card lines correctly. Falls back
// to OCR.space, then Google Vision. Explicit OCR_MODE always wins.
function resolveMode(): string {
  const explicit = (process.env.OCR_MODE || "").toLowerCase();
  if (explicit) return explicit;
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.OCR_SPACE_API_KEY) return "ocrspace";
  if (process.env.GOOGLE_VISION_API_KEY) return "google";
  // Pilot default: try real OCR with OCR.space's public demo key. Operators
  // can still force manual entry with OCR_MODE=manual, but silent no-OCR is a
  // bad default for store employees taking report photos.
  return "ocrspace";
}

function pickProvider(): Type<any> {
  switch (resolveMode()) {
    case "anthropic":
      return AnthropicVisionOCRService;
    case "google":
      return GoogleVisionOCRService;
    case "ocrspace":
      return OcrSpaceOCRService;
    case "demo":
      return MockOCRService;
    case "manual":
    default:
      return ManualEntryOCRService;
  }
}

@Module({
  providers: [
    AnthropicVisionOCRService,
    GoogleVisionOCRService,
    OcrSpaceOCRService,
    MockOCRService,
    ManualEntryOCRService,
    {
      provide: "OCRService",
      useClass: pickProvider()
    }
  ],
  exports: ["OCRService"]
})
export class OcrModule {}

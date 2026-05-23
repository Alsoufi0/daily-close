import { Module, Type } from "@nestjs/common";
import { ManualEntryOCRService, MockOCRService } from "./ocr.service";
import { OcrSpaceOCRService } from "./ocr-space.service";
import { GoogleVisionOCRService } from "./google-vision.service";

// Auto-detect provider when OCR_MODE is unset: prefer OCR.space for receipt
// photos. It reads the current terminal/Z reports more reliably than Google
// Vision in production. Explicit
// OCR_MODE always wins.
function resolveMode(): string {
  const explicit = (process.env.OCR_MODE || "").toLowerCase();
  if (explicit) return explicit;
  if (process.env.OCR_SPACE_API_KEY) return "ocrspace";
  if (process.env.GOOGLE_VISION_API_KEY) return "google";
  // Pilot default: try real OCR with OCR.space's public demo key. Operators
  // can still force manual entry with OCR_MODE=manual, but silent no-OCR is a
  // bad default for store employees taking report photos.
  return "ocrspace";
}

function pickProvider(): Type<any> {
  switch (resolveMode()) {
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

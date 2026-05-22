import { Module, Type } from "@nestjs/common";
import { ManualEntryOCRService, MockOCRService } from "./ocr.service";
import { OcrSpaceOCRService } from "./ocr-space.service";

const mode = (process.env.OCR_MODE || "manual").toLowerCase();

function pickProvider(): Type<any> {
  switch (mode) {
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

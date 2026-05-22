import { Module } from "@nestjs/common";
import { ManualEntryOCRService, MockOCRService } from "./ocr.service";

const useDemo = process.env.OCR_MODE === "demo";

@Module({
  providers: [
    {
      provide: "OCRService",
      useClass: useDemo ? MockOCRService : ManualEntryOCRService
    }
  ],
  exports: ["OCRService"]
})
export class OcrModule {}

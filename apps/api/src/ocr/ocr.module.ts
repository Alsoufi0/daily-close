import { Module } from "@nestjs/common";
import { MockOCRService } from "./ocr.service";

@Module({
  providers: [{ provide: "OCRService", useClass: MockOCRService }],
  exports: ["OCRService"]
})
export class OcrModule {}

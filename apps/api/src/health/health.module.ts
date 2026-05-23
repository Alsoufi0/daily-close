import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller";
import { OcrModule } from "../ocr/ocr.module";

@Module({
  imports: [OcrModule],
  controllers: [HealthController]
})
export class HealthModule {}

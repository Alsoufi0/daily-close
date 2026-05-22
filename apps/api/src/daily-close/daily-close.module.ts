import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { OcrModule } from "../ocr/ocr.module";
import { PosParsersModule } from "../pos-parsers/pos-parsers.module";
import { SupabaseModule } from "../supabase/supabase.module";
import { DailyCloseController } from "./daily-close.controller";
import { DailyCloseRepository } from "./daily-close.repository";
import { DailyCloseService } from "./daily-close.service";

@Module({
  imports: [AuthModule, OcrModule, PosParsersModule, SupabaseModule],
  controllers: [DailyCloseController],
  providers: [DailyCloseService, DailyCloseRepository],
  exports: [DailyCloseService]
})
export class DailyCloseModule {}

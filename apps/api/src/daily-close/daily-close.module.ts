import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { OcrModule } from "../ocr/ocr.module";
import { PosParsersModule } from "../pos-parsers/pos-parsers.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { SupabaseModule } from "../supabase/supabase.module";
import { SubscriptionsModule } from "../subscriptions/subscriptions.module";
import { DailyCloseController } from "./daily-close.controller";
import { DailyCloseRepository } from "./daily-close.repository";
import { DailyCloseService } from "./daily-close.service";

@Module({
  // SubscriptionsModule is imported so DailyCloseController can apply
  // SubscriptionGuard to write endpoints (audit fix #8). Without it, owners
  // could keep submitting closes / editing closes after their trial expired.
  imports: [
    AuthModule,
    OcrModule,
    PosParsersModule,
    SupabaseModule,
    NotificationsModule,
    SubscriptionsModule
  ],
  controllers: [DailyCloseController],
  providers: [DailyCloseService, DailyCloseRepository],
  exports: [DailyCloseService]
})
export class DailyCloseModule {}

import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { MissedCloseService } from "./missed-close.service";
import { NotificationsController } from "./notifications.controller";
import { NotificationsService } from "./notifications.service";
import { SmsService } from "./sms.service";
import { WeeklySummaryService } from "./weekly-summary.service";
import { WhatsAppService } from "./whatsapp.service";

@Module({
  imports: [AuthModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, MissedCloseService, WeeklySummaryService, WhatsAppService, SmsService],
  exports: [NotificationsService, MissedCloseService, WeeklySummaryService, WhatsAppService, SmsService]
})
export class NotificationsModule {}

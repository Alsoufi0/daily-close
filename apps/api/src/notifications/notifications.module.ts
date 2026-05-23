import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { MissedCloseService } from "./missed-close.service";
import { NotificationsController } from "./notifications.controller";
import { NotificationsService } from "./notifications.service";
import { WeeklySummaryService } from "./weekly-summary.service";
import { WhatsAppService } from "./whatsapp.service";

@Module({
  imports: [AuthModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, MissedCloseService, WeeklySummaryService, WhatsAppService],
  exports: [NotificationsService, MissedCloseService, WeeklySummaryService, WhatsAppService]
})
export class NotificationsModule {}

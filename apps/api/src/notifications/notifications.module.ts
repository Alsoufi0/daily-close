import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { SubscriptionsModule } from "../subscriptions/subscriptions.module";
import { MissedCloseService } from "./missed-close.service";
import { NotificationsController } from "./notifications.controller";
import { NotificationsService } from "./notifications.service";
import { SmsService } from "./sms.service";
import { EmailService } from "./email.service";
import { PushService } from "./push.service";
import { SmsWebhookController } from "./sms-webhook.controller";
import { WeeklySummaryService } from "./weekly-summary.service";
import { WhatsAppService } from "./whatsapp.service";

@Module({
  imports: [AuthModule, SubscriptionsModule],
  controllers: [NotificationsController, SmsWebhookController],
  providers: [NotificationsService, MissedCloseService, WeeklySummaryService, WhatsAppService, SmsService, EmailService, PushService],
  exports: [NotificationsService, MissedCloseService, WeeklySummaryService, WhatsAppService, SmsService, EmailService, PushService]
})
export class NotificationsModule {}

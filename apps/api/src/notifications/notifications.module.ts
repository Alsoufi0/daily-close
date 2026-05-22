import { Module } from "@nestjs/common";
import { MissedCloseService } from "./missed-close.service";
import { NotificationsController } from "./notifications.controller";
import { NotificationsService } from "./notifications.service";

@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, MissedCloseService],
  exports: [NotificationsService, MissedCloseService]
})
export class NotificationsModule {}

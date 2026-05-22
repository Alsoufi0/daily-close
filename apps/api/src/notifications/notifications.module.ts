import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { MissedCloseService } from "./missed-close.service";
import { NotificationsController } from "./notifications.controller";
import { NotificationsService } from "./notifications.service";

@Module({
  imports: [AuthModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, MissedCloseService],
  exports: [NotificationsService, MissedCloseService]
})
export class NotificationsModule {}

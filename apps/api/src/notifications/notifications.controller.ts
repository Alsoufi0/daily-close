import {
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  UseGuards
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../auth/current-user.decorator";
import { RequestUser } from "../auth/request-user";
import { SupabaseAuthGuard } from "../auth/supabase-auth.guard";
import { MissedCloseService } from "./missed-close.service";
import { NotificationsService } from "./notifications.service";

@ApiTags("Notifications")
@Controller("notifications")
export class NotificationsController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly missedClose: MissedCloseService
  ) {}

  @Get()
  @ApiBearerAuth()
  @UseGuards(SupabaseAuthGuard)
  list(@CurrentUser() user: RequestUser) {
    return this.notifications.listForUser(user);
  }

  @Patch(":id/read")
  @ApiBearerAuth()
  @UseGuards(SupabaseAuthGuard)
  markRead(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.notifications.markRead(id, user);
  }

  @Delete(":id")
  @ApiBearerAuth()
  @UseGuards(SupabaseAuthGuard)
  remove(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.notifications.remove(id, user);
  }

  // Hit by the Render cron - secured by a shared CRON_SECRET header.
  // When CRON_SECRET is unset, the route is open (dev convenience).
  @Post("check-missed-close")
  checkMissedClose(@Headers("x-cron-secret") provided: string | undefined) {
    const expected = process.env.CRON_SECRET;
    if (expected && provided !== expected) {
      throw new ForbiddenException("Bad cron secret.");
    }
    return this.missedClose.checkStores();
  }
}

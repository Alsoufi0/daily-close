import {
  Body,
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
import { WhatsAppService } from "./whatsapp.service";
import { WeeklySummaryService } from "./weekly-summary.service";

@ApiTags("Notifications")
@Controller("notifications")
export class NotificationsController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly missedClose: MissedCloseService,
    private readonly weekly: WeeklySummaryService,
    private readonly whatsapp: WhatsAppService
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

  @Get("whatsapp-settings")
  @ApiBearerAuth()
  @UseGuards(SupabaseAuthGuard)
  getWhatsAppSettings(@CurrentUser() user: RequestUser) {
    return this.notifications.getWhatsAppSettings(user);
  }

  @Patch("whatsapp-settings")
  @ApiBearerAuth()
  @UseGuards(SupabaseAuthGuard)
  updateWhatsAppSettings(
    @CurrentUser() user: RequestUser,
    @Body() input: {
      whatsappPhone?: string | null;
      whatsappAlertsEnabled?: boolean;
      whatsappCloseAlertsEnabled?: boolean;
      whatsappReportsEnabled?: boolean;
    }
  ) {
    return this.notifications.updateWhatsAppSettings(user, input);
  }

  @Post("whatsapp-settings/test")
  @ApiBearerAuth()
  @UseGuards(SupabaseAuthGuard)
  async testWhatsApp(@CurrentUser() user: RequestUser) {
    if (user.role !== "STORE_OWNER" || !user.ownerId) {
      throw new ForbiddenException("Only owners can test WhatsApp settings.");
    }
    const prefs = await this.notifications.getOwnerWhatsAppPreferences(user.ownerId);
    if (!prefs.phone) {
      return { sent: false, message: "Add a WhatsApp phone number first." };
    }
    if (!this.whatsapp.isConfigured()) {
      return { sent: false, message: "WhatsApp is not configured on the server." };
    }
    const sent = await this.whatsapp.sendCloseCompletedTemplate({
      toPhone: prefs.phone,
      ownerName: user.name || "Owner",
      storeName: "Daily Close test"
    });
    return {
      sent,
      message: sent
        ? "Test WhatsApp message sent."
        : "WhatsApp test did not send. Check Meta template approval, recipient access, and Render env vars."
    };
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

  // Hit by the weekly cron (Monday 13:00 UTC by default). Same shared secret.
  @Post("weekly-summary")
  weeklySummary(@Headers("x-cron-secret") provided: string | undefined) {
    const expected = process.env.CRON_SECRET;
    if (expected && provided !== expected) {
      throw new ForbiddenException("Bad cron secret.");
    }
    return this.weekly.sendForAllOwners();
  }

  @Post("monthly-summary")
  monthlySummary(@Headers("x-cron-secret") provided: string | undefined) {
    const expected = process.env.CRON_SECRET;
    if (expected && provided !== expected) {
      throw new ForbiddenException("Bad cron secret.");
    }
    return this.weekly.sendMonthlyForAllOwners();
  }
}

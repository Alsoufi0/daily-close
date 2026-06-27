import {
  BadRequestException,
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
import { SubscriptionGuard } from "../subscriptions/subscription.guard";
import { MissedCloseService } from "./missed-close.service";
import { NotificationsService } from "./notifications.service";
import { SmsService } from "./sms.service";
import { WhatsAppService } from "./whatsapp.service";
import { WeeklySummaryService } from "./weekly-summary.service";
import { EmailService } from "./email.service";
import { PushService } from "./push.service";
import { withDbRetry } from "../prisma/db-retry";

@ApiTags("Notifications")
@Controller("notifications")
export class NotificationsController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly missedClose: MissedCloseService,
    private readonly weekly: WeeklySummaryService,
    private readonly whatsapp: WhatsAppService,
    private readonly sms: SmsService,
    private readonly email: EmailService,
    private readonly push: PushService
  ) {}

  @Post("contact")
  async contact(
    @Body()
    input: {
      name?: string;
      email?: string;
      phone?: string;
      storeCount?: string;
      message?: string;
    }
  ) {
    const name = input.name?.trim() || "";
    const email = input.email?.trim().toLowerCase() || "";
    const phone = input.phone?.trim() || "";
    const storeCount = input.storeCount?.trim() || "";
    const message = input.message?.trim() || "";
    if (!name) throw new BadRequestException("Name is required.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new BadRequestException("Valid email is required.");
    }
    if (message.length < 10) {
      throw new BadRequestException("Message must be at least 10 characters.");
    }

    const result = await this.email.sendContactMessage({
      name,
      email,
      phone,
      storeCount,
      message
    });
    return {
      sent: result.sent,
      message: result.sent
        ? "Message sent."
        : "Email is not configured. Please email dailyclose@yahoo.com directly."
    };
  }

  @Get()
  @ApiBearerAuth()
  @UseGuards(SupabaseAuthGuard, SubscriptionGuard)
  list(@CurrentUser() user: RequestUser) {
    return this.notifications.listForUser(user);
  }

  // Register a device's Expo push token. Declared BEFORE the ":id" routes so
  // the static "push-token" path isn't swallowed by @Delete(":id"). NOT
  // subscription-gated on purpose: a locked/unpaid owner should still be
  // reachable (e.g. a "renew" nudge), and an employee can register regardless
  // of the owner's billing state.
  @Post("push-token")
  @ApiBearerAuth()
  @UseGuards(SupabaseAuthGuard)
  registerPushToken(
    @CurrentUser() user: RequestUser,
    @Body() body: { token?: string; platform?: string }
  ) {
    if (!body?.token) throw new BadRequestException("token is required.");
    return this.push.registerToken(user.id, body.token, body.platform);
  }

  @Delete("push-token")
  @ApiBearerAuth()
  @UseGuards(SupabaseAuthGuard)
  removePushToken(@Body() body: { token?: string }) {
    if (!body?.token) throw new BadRequestException("token is required.");
    return this.push.removeToken(body.token);
  }

  @Patch(":id/read")
  @ApiBearerAuth()
  @UseGuards(SupabaseAuthGuard, SubscriptionGuard)
  markRead(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.notifications.markRead(id, user);
  }

  @Delete(":id")
  @ApiBearerAuth()
  @UseGuards(SupabaseAuthGuard, SubscriptionGuard)
  remove(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.notifications.remove(id, user);
  }

  @Get("whatsapp-settings")
  @ApiBearerAuth()
  @UseGuards(SupabaseAuthGuard, SubscriptionGuard)
  getWhatsAppSettings(@CurrentUser() user: RequestUser) {
    return this.notifications.getWhatsAppSettings(user);
  }

  @Patch("whatsapp-settings")
  @ApiBearerAuth()
  @UseGuards(SupabaseAuthGuard, SubscriptionGuard)
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
  @UseGuards(SupabaseAuthGuard, SubscriptionGuard)
  async testWhatsApp(@CurrentUser() user: RequestUser) {
    if (user.role !== "STORE_OWNER" || !user.ownerId) {
      throw new ForbiddenException("Only owners can test WhatsApp settings.");
    }
    const prefs = await this.notifications.getOwnerWhatsAppPreferences(user.ownerId);
    if (!prefs.phone) {
      return { sent: false, message: "Add a WhatsApp phone number first." };
    }
    const sentByMeta = this.whatsapp.isConfigured()
      ? await this.whatsapp.sendCloseCompletedTemplate({
          toPhone: prefs.phone,
          ownerName: user.name || "Owner",
          storeName: "Daily Close test"
        })
      : false;
    const sent = sentByMeta || (await this.sms.send(prefs.phone, "Daily Close: test WhatsApp message.")).sent;
    return {
      sent,
      message: sent
        ? "Test WhatsApp message sent."
        : "WhatsApp test did not send. Check Twilio/Meta setup, recipient access, and Render env vars."
    };
  }

  // Cron endpoints (audit fixes #4.2, #10):
  //
  //   1. assertCronSecret: in production we refuse when CRON_SECRET is unset
  //      — the old `if (expected && ...)` short-circuit meant a misconfigured
  //      prod accepted anonymous POSTs. In dev we still allow missing secrets
  //      so local invocation is friction-free.
  //
  //   2. pingHealthcheck: optional heartbeat to an external dead-man monitor
  //      (healthchecks.io / Better Stack / Uptime Kuma). Fires AFTER the cron
  //      payload completes, so a silent cron failure (Render misfires, throws,
  //      timeouts) makes the heartbeat stop arriving and the monitor pages.
  //      Configure via HEALTHCHECKS_*_PING_URL env vars. Fire-and-forget.

  @Post("check-missed-close")
  async checkMissedClose(@Headers("x-cron-secret") provided: string | undefined) {
    NotificationsController.assertCronSecret(provided);
    const result = await withDbRetry(() => this.missedClose.checkStores(), {
      label: "check-missed-close"
    });
    NotificationsController.pingHealthcheck(process.env.HEALTHCHECKS_MISSED_CLOSE_PING_URL);
    return result;
  }

  @Post("weekly-summary")
  async weeklySummary(@Headers("x-cron-secret") provided: string | undefined) {
    NotificationsController.assertCronSecret(provided);
    const result = await withDbRetry(() => this.weekly.sendForAllOwners(), {
      label: "weekly-summary"
    });
    NotificationsController.pingHealthcheck(process.env.HEALTHCHECKS_WEEKLY_SUMMARY_PING_URL);
    return result;
  }

  @Post("monthly-summary")
  async monthlySummary(@Headers("x-cron-secret") provided: string | undefined) {
    NotificationsController.assertCronSecret(provided);
    const result = await withDbRetry(() => this.weekly.sendMonthlyForAllOwners(), {
      label: "monthly-summary"
    });
    NotificationsController.pingHealthcheck(process.env.HEALTHCHECKS_MONTHLY_SUMMARY_PING_URL);
    return result;
  }

  private static assertCronSecret(provided: string | undefined) {
    const expected = process.env.CRON_SECRET;
    if (!expected) {
      if (process.env.NODE_ENV === "production") {
        throw new ForbiddenException("CRON_SECRET is not configured.");
      }
      return; // dev convenience: allow when unset locally
    }
    if (provided !== expected) {
      throw new ForbiddenException("Bad cron secret.");
    }
  }

  private static pingHealthcheck(url: string | undefined) {
    if (!url) return;
    // Fire-and-forget. We never want the heartbeat to fail the cron payload.
    // Catch and swallow so a healthcheck outage doesn't make Render mark the
    // cron job as failed.
    fetch(url, { method: "POST" }).catch(() => {
      // eslint-disable-next-line no-console
      console.warn(`[cron] healthcheck heartbeat to ${url} failed; cron itself succeeded.`);
    });
  }
}

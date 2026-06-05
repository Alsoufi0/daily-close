import { Body, Controller, Delete, ForbiddenException, Get, Headers, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { EditDailyCloseDto } from "./dto/edit-daily-close.dto";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../auth/current-user.decorator";
import { RequestUser } from "../auth/request-user";
import { SupabaseAuthGuard } from "../auth/supabase-auth.guard";
import { SubscriptionGuard } from "../subscriptions/subscription.guard";
import { DailyCloseService } from "./daily-close.service";
import { CreateDailyCloseDto } from "./dto/create-daily-close.dto";
import { ScanReportDto } from "./dto/scan-report.dto";
import { UploadReportDto } from "./dto/upload-report.dto";

// Audit fix #8: every write endpoint here is gated by both SupabaseAuthGuard
// (authn) and SubscriptionGuard (paywall enforcement). SubscriptionGuard is
// a no-op for employees and only blocks owners whose trial/subscription has
// lapsed — so employees never lose the ability to close their store, but a
// trial-expired owner can't keep using the product without paying.

@ApiTags("Daily Close")
@ApiBearerAuth()
@Controller("daily-close")
export class DailyCloseController {
  constructor(private readonly dailyCloseService: DailyCloseService) {}

  @Post("scan-report")
  scanReport(@Body() input: ScanReportDto) {
    return this.dailyCloseService.scanReport(input);
  }

  // Debug: returns raw OCR text + parsed fields. Owner-only — never expose
  // parsed sales for stores the caller doesn't own.
  @Post("debug-ocr")
  @UseGuards(SupabaseAuthGuard)
  debugOcr(@Body() input: ScanReportDto, @CurrentUser() user: RequestUser) {
    return this.dailyCloseService.debugOcr(input, user);
  }

  @Post("upload-report")
  @UseGuards(SupabaseAuthGuard, SubscriptionGuard)
  uploadReport(@Body() input: UploadReportDto, @CurrentUser() user: RequestUser) {
    return this.dailyCloseService.uploadReport(input, user);
  }

  // Up-front guard for the close flow: tells the client whether this store is
  // already closed for the chosen date, BEFORE the employee does the whole
  // close only to be rejected at submit. Read-only — no SubscriptionGuard.
  @Get("exists")
  @UseGuards(SupabaseAuthGuard)
  closeExists(
    @Query("storeId") storeId: string,
    @Query("date") date: string,
    @CurrentUser() user: RequestUser
  ) {
    return this.dailyCloseService.closeExistsForDate(user, storeId, date);
  }

  // Cron: purge abandoned receipt uploads (never attached to a completed close)
  // older than the retention window. Guarded by x-cron-secret like the other
  // crons; run daily from Render. Backs the privacy policy's 7-day promise.
  @Post("cron/purge-receipts")
  purgeReceipts(@Headers("x-cron-secret") provided: string | undefined) {
    const expected = process.env.CRON_SECRET;
    if (!expected) {
      if (process.env.NODE_ENV === "production") {
        throw new ForbiddenException("CRON_SECRET is not configured.");
      }
    } else if (provided !== expected) {
      throw new ForbiddenException("Bad cron secret.");
    }
    return this.dailyCloseService.purgeAbandonedReceipts(7);
  }

  @Post("finish")
  @UseGuards(SupabaseAuthGuard, SubscriptionGuard)
  finishClosing(
    @Body() input: CreateDailyCloseDto,
    @CurrentUser() user: RequestUser,
    @Headers("idempotency-key") idempotencyKey?: string
  ) {
    return this.dailyCloseService.finishClosing(input, user, idempotencyKey);
  }

  @Patch(":id")
  @UseGuards(SupabaseAuthGuard, SubscriptionGuard)
  editClosing(
    @Param("id") id: string,
    @Body() input: EditDailyCloseDto,
    @CurrentUser() user: RequestUser
  ) {
    return this.dailyCloseService.editClosing(id, input, user);
  }

  @Delete(":id")
  @UseGuards(SupabaseAuthGuard, SubscriptionGuard)
  deleteClosing(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.dailyCloseService.deleteClosing(id, user);
  }
}

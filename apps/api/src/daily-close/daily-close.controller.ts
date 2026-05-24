import { Body, Controller, Delete, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { EditDailyCloseDto } from "./dto/edit-daily-close.dto";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../auth/current-user.decorator";
import { RequestUser } from "../auth/request-user";
import { SupabaseAuthGuard } from "../auth/supabase-auth.guard";
import { DailyCloseService } from "./daily-close.service";
import { CreateDailyCloseDto } from "./dto/create-daily-close.dto";
import { ScanReportDto } from "./dto/scan-report.dto";
import { UploadReportDto } from "./dto/upload-report.dto";

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
  @UseGuards(SupabaseAuthGuard)
  uploadReport(@Body() input: UploadReportDto, @CurrentUser() user: RequestUser) {
    return this.dailyCloseService.uploadReport(input, user);
  }

  @Post("finish")
  @UseGuards(SupabaseAuthGuard)
  finishClosing(@Body() input: CreateDailyCloseDto, @CurrentUser() user: RequestUser) {
    return this.dailyCloseService.finishClosing(input, user);
  }

  @Patch(":id")
  @UseGuards(SupabaseAuthGuard)
  editClosing(
    @Param("id") id: string,
    @Body() input: EditDailyCloseDto,
    @CurrentUser() user: RequestUser
  ) {
    return this.dailyCloseService.editClosing(id, input, user);
  }

  @Delete(":id")
  @UseGuards(SupabaseAuthGuard)
  deleteClosing(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.dailyCloseService.deleteClosing(id, user);
  }
}

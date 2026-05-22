import { Controller, Get, Header, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../auth/current-user.decorator";
import { RequestUser } from "../auth/request-user";
import { SupabaseAuthGuard } from "../auth/supabase-auth.guard";
import { ReportsService } from "./reports.service";

@ApiTags("Reports")
@ApiBearerAuth()
@Controller("reports")
@UseGuards(SupabaseAuthGuard)
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get("today.csv")
  @Header("Content-Type", "text/csv")
  @Header("Content-Disposition", "attachment; filename=\"today-close-report.csv\"")
  todayCsv(@CurrentUser() user: RequestUser) {
    return this.reports.buildTodayCsv(user);
  }
}

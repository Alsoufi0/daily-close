import { Controller, Get, Header, Query, Res, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../auth/current-user.decorator";
import { RequestUser } from "../auth/request-user";
import { SupabaseAuthGuard } from "../auth/supabase-auth.guard";
import { ReportQueryDto } from "./dto/report-query.dto";
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

  @Get("export.csv")
  @Header("Content-Type", "text/csv; charset=utf-8")
  @Header("Content-Disposition", "attachment; filename=\"daily-close-report.csv\"")
  csv(@CurrentUser() user: RequestUser, @Query() query: ReportQueryDto) {
    return this.reports.buildFilteredCsv(user, query);
  }

  @Get("export.pdf")
  async pdf(@CurrentUser() user: RequestUser, @Query() query: ReportQueryDto, @Res() res: any) {
    const bytes = await this.reports.buildPdf(user, query);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=\"daily-close-report.pdf\"");
    res.send(Buffer.from(bytes));
  }
}

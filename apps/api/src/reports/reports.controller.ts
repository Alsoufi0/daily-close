import { Controller, Get, Header, Param, Query, Res, UseGuards } from "@nestjs/common";
import archiver from "archiver";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../auth/current-user.decorator";
import { RequestUser } from "../auth/request-user";
import { SupabaseAuthGuard } from "../auth/supabase-auth.guard";
import { SubscriptionGuard } from "../subscriptions/subscription.guard";
import { SupabaseStorageService } from "../supabase/supabase-storage.service";
import { ReportQueryDto } from "./dto/report-query.dto";
import { ReceiptsQueryDto } from "./dto/receipts-query.dto";
import { ReportsService } from "./reports.service";

@ApiTags("Reports")
@ApiBearerAuth()
@Controller("reports")
@UseGuards(SupabaseAuthGuard)
export class ReportsController {
  constructor(
    private readonly reports: ReportsService,
    private readonly storage: SupabaseStorageService
  ) {}

  @Get("receipts")
  @UseGuards(SupabaseAuthGuard, SubscriptionGuard)
  listReceipts(@CurrentUser() user: RequestUser, @Query() query: ReceiptsQueryDto) {
    return this.reports.listReceipts(query, user);
  }

  // NOTE: `receipts/download` (bulk zip) MUST be declared before
  // `receipts/:id/download` so Nest doesn't match the literal "download"
  // segment as an id.
  @Get("receipts/download")
  @UseGuards(SupabaseAuthGuard, SubscriptionGuard)
  async downloadAllReceipts(
    @CurrentUser() user: RequestUser,
    @Query() query: ReceiptsQueryDto,
    @Res() res: any
  ) {
    const { storeName, items } = await this.reports.listReceiptsForDownload(query, user);
    const safeStore = storeName.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "store";
    res.setHeader("Content-Type", "application/zip");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="receipts-${safeStore}-${query.from || "start"}-${query.to || "today"}.zip"`
    );

    const zip = archiver("zip", { zlib: { level: 6 } });
    zip.on("warning", (err: any) => {
      if (err?.code !== "ENOENT") throw err;
    });
    zip.pipe(res);

    for (const item of items) {
      let buf: Buffer | null = null;
      if (item.storagePath) {
        buf = await this.storage.download(item.storagePath);
      }
      if (!buf && item.imageUrl) {
        try {
          const r = await fetch(item.imageUrl);
          if (r.ok) buf = Buffer.from(await r.arrayBuffer());
        } catch {
          /* skip — best-effort */
        }
      }
      if (buf) zip.append(buf, { name: item.filename });
    }
    await zip.finalize();
  }

  @Get("receipts/:id/download")
  @UseGuards(SupabaseAuthGuard, SubscriptionGuard)
  async downloadReceipt(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Res() res: any
  ) {
    const { filename, buffer, redirectUrl, contentType } = await this.reports.downloadReceipt(id, user);
    if (buffer) {
      res.setHeader("Content-Type", contentType);
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(buffer);
      return;
    }
    if (redirectUrl) {
      // Redirect to the (fresh) signed URL. Adding ?download=… is a
      // Supabase convention that makes the response a forced download.
      const sep = redirectUrl.includes("?") ? "&" : "?";
      res.redirect(302, `${redirectUrl}${sep}download=${encodeURIComponent(filename)}`);
      return;
    }
    res.status(404).send("Receipt unavailable.");
  }

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

import { Controller, Get, Header, Logger, Param, Query, Res, UseGuards } from "@nestjs/common";
import archiver from "archiver";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../auth/current-user.decorator";
import { RequestUser } from "../auth/request-user";
import { SupabaseAuthGuard } from "../auth/supabase-auth.guard";
import { SupabaseStorageService } from "../supabase/supabase-storage.service";
import { ReportQueryDto } from "./dto/report-query.dto";
import { ReceiptsQueryDto } from "./dto/receipts-query.dto";
import { ReportsService } from "./reports.service";

@ApiTags("Reports")
@ApiBearerAuth()
@Controller("reports")
// Read-only report endpoints (receipts list/download, CSV/PDF export) are NOT
// behind SubscriptionGuard: an owner must always be able to read and export
// their OWN historical data, even if billing lapses — you never ransom a
// customer's own records. The paywall is enforced on the value-generating
// WRITE actions instead (daily-close submit, add store, manage employees,
// dashboard, notifications) — see those controllers.
@UseGuards(SupabaseAuthGuard)
export class ReportsController {
  private readonly logger = new Logger(ReportsController.name);

  constructor(
    private readonly reports: ReportsService,
    private readonly storage: SupabaseStorageService
  ) {}

  @Get("receipts")
  listReceipts(@CurrentUser() user: RequestUser, @Query() query: ReceiptsQueryDto) {
    return this.reports.listReceipts(query, user);
  }

  // NOTE: `receipts/download` (bulk zip) MUST be declared before
  // `receipts/:id/download` so Nest doesn't match the literal "download"
  // segment as an id.
  @Get("receipts/download")
  async downloadAllReceipts(
    @CurrentUser() user: RequestUser,
    @Query() query: ReceiptsQueryDto,
    @Res() res: any
  ) {
    // Resolve the file list BEFORE touching the response. If this throws (bad
    // query / scope error), it happens before any header is set, so Nest's
    // exception filter returns a clean JSON error instead of a corrupt stream.
    let storeName: string;
    let items: Array<{ filename: string; storagePath: string | null; imageUrl: string }>;
    try {
      ({ storeName, items } = await this.reports.listReceiptsForDownload(query, user));
    } catch (err: any) {
      this.logger.error(`Bulk receipt listing failed: ${err?.message || err}`, err?.stack);
      throw err;
    }

    // Download every file's bytes FIRST, in parallel (concurrency-capped),
    // THEN build the zip. The old code downloaded one-at-a-time inside the
    // stream loop; a store with several receipts could exceed the request
    // timeout → the client saw "Internal server error". Each fetch is
    // best-effort — a missing/expired object resolves to null and is skipped,
    // never thrown.
    const fetchOne = async (
      item: { filename: string; storagePath: string | null; imageUrl: string }
    ): Promise<{ name: string; buf: Buffer } | null> => {
      if (item.storagePath) {
        try {
          const buf = await this.storage.download(item.storagePath);
          if (buf) return { name: item.filename, buf };
        } catch (err: any) {
          this.logger.warn(`Receipt storage download failed (${item.filename}): ${err?.message || err}`);
        }
      }
      if (item.imageUrl) {
        try {
          const r = await fetch(item.imageUrl);
          if (r.ok) return { name: item.filename, buf: Buffer.from(await r.arrayBuffer()) };
        } catch (err: any) {
          this.logger.warn(`Receipt url fetch failed (${item.filename}): ${err?.message || err}`);
        }
      }
      return null;
    };

    const CONCURRENCY = 6;
    const fetched: Array<{ name: string; buf: Buffer } | null> = [];
    for (let i = 0; i < items.length; i += CONCURRENCY) {
      fetched.push(...(await Promise.all(items.slice(i, i + CONCURRENCY).map(fetchOne))));
    }
    const files = fetched.filter((f): f is { name: string; buf: Buffer } => f !== null);

    const safeStore = storeName.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "store";
    res.setHeader("Content-Type", "application/zip");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="receipts-${safeStore}-${query.from || "start"}-${query.to || "today"}.zip"`
    );

    const zip = archiver("zip", { zlib: { level: 6 } });
    // Log warnings/errors — never throw. A throw inside these listeners fires
    // AFTER headers are sent, which corrupts the response into an "internal
    // server error" instead of a usable (partial) zip.
    zip.on("warning", (err: any) => this.logger.warn(`zip warning: ${err?.message || err}`));
    zip.on("error", (err: any) => this.logger.error(`zip error: ${err?.message || err}`));
    zip.pipe(res);
    for (const f of files) zip.append(f.buf, { name: f.name });
    await zip.finalize();
  }

  @Get("receipts/:id/download")
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

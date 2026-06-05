import { ForbiddenException, Injectable, Logger, NotFoundException, Optional } from "@nestjs/common";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { loadFontsForLang } from "./pdf-fonts";
import { RequestUser } from "../auth/request-user";
import { resolveAdminScope, scopeAllowsStore, storeWhereForScope } from "../auth/admin-scope";
import { DashboardService } from "../dashboard/dashboard.service";
import { PrismaService } from "../prisma/prisma.service";
import { SupabaseStorageService } from "../supabase/supabase-storage.service";
import { ReportQueryDto } from "./dto/report-query.dto";
import { ReceiptsQueryDto } from "./dto/receipts-query.dto";
import { netProfit } from "@shared/utils/money";

type ReportLang = NonNullable<ReportQueryDto["lang"]>;

interface ReportRow {
  storeName: string;
  employeeName: string;
  closeDate: string;
  closeTime: string;
  totalSales: number;
  cashExpected: number;
  cashCounted: number;
  difference: number;
  expenses: number;
  netProfit: number;
  status: string;
  notes: string;
  completedAt: string;
}

const labels: Record<ReportLang, Record<string, string>> = {
  en: {
    title: "Daily Close Report",
    filters: "Filters",
    summary: "Summary",
    generated: "Export created",
    dateRange: "Date range",
    allStores: "All stores",
    store: "Store",
    employee: "Employee",
    closeDate: "Close Date",
    closeTime: "Close Time",
    totalSales: "Sales Total",
    cashExpected: "Cash Expected",
    cashCounted: "Cash Counted",
    difference: "Short/Over",
    expenses: "Expenses",
    netProfit: "Net Profit",
    status: "Status",
    notes: "Notes",
    completedAt: "Completed At",
    closes: "Closes",
    shortage: "Shortage",
    closed: "Closed",
    short: "Short",
    over: "Over",
    pending: "Pending"
  },
  ar: {
    title: "تقرير الإغلاق اليومي",
    filters: "الفلاتر",
    summary: "الملخص",
    generated: "وقت التصدير",
    dateRange: "نطاق التاريخ",
    allStores: "كل المتاجر",
    store: "المتجر",
    employee: "الموظف",
    closeDate: "تاريخ الإغلاق",
    closeTime: "وقت الإغلاق",
    totalSales: "إجمالي المبيعات",
    cashExpected: "النقد المتوقع",
    cashCounted: "النقد المعدود",
    difference: "نقص/زيادة",
    expenses: "المصاريف",
    netProfit: "صافي الربح",
    status: "الحالة",
    notes: "ملاحظات",
    completedAt: "وقت الإكمال",
    closes: "الإغلاقات",
    shortage: "النقص",
    closed: "مغلق",
    short: "ناقص",
    over: "زائد",
    pending: "معلق"
  },
  es: {
    title: "Reporte de Cierre Diario",
    filters: "Filtros",
    summary: "Resumen",
    generated: "Exportación creada",
    dateRange: "Rango de fechas",
    allStores: "Todas las tiendas",
    store: "Tienda",
    employee: "Empleado",
    closeDate: "Fecha de cierre",
    closeTime: "Hora de cierre",
    totalSales: "Ventas totales",
    cashExpected: "Efectivo esperado",
    cashCounted: "Efectivo contado",
    difference: "Falta/Sobra",
    expenses: "Gastos",
    netProfit: "Ganancia neta",
    status: "Estado",
    notes: "Notas",
    completedAt: "Completado",
    closes: "Cierres",
    shortage: "Faltante",
    closed: "Cerrado",
    short: "Faltante",
    over: "Sobrante",
    pending: "Pendiente"
  },
  hi: {
    title: "दैनिक क्लोज रिपोर्ट",
    filters: "फिल्टर",
    summary: "सारांश",
    generated: "एक्सपोर्ट समय",
    dateRange: "तारीख सीमा",
    allStores: "सभी स्टोर",
    store: "स्टोर",
    employee: "कर्मचारी",
    closeDate: "क्लोज तारीख",
    closeTime: "क्लोज समय",
    totalSales: "कुल बिक्री",
    cashExpected: "अपेक्षित नकद",
    cashCounted: "गिना हुआ नकद",
    difference: "कम/ज्यादा",
    expenses: "खर्च",
    netProfit: "शुद्ध लाभ",
    status: "स्थिति",
    notes: "नोट्स",
    completedAt: "पूरा हुआ",
    closes: "क्लोज",
    shortage: "कमी",
    closed: "बंद",
    short: "कमी",
    over: "ज्यादा",
    pending: "बाकी"
  }
};

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private readonly dashboard: DashboardService,
    private readonly prisma: PrismaService,
    // Optional so the existing unit tests (`new ReportsService({} as any, prisma)`)
    // keep working without supplying a storage mock — they don't exercise the
    // signed-URL path.
    @Optional() private readonly storage?: SupabaseStorageService
  ) {}

  private t(lang: ReportLang, key: string) {
    return labels[lang]?.[key] ?? labels.en[key] ?? key;
  }

  private localDate(timezone: string, value: Date): string {
    try {
      return new Intl.DateTimeFormat("en-CA", {
        timeZone: timezone || "America/New_York",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      }).format(value);
    } catch {
      return value.toISOString().slice(0, 10);
    }
  }

  private localTime(timezone: string, value: Date, lang: ReportLang): string {
    try {
      return new Intl.DateTimeFormat(lang === "ar" ? "ar" : lang === "hi" ? "hi-IN" : lang, {
        timeZone: timezone || "America/New_York",
        dateStyle: "medium",
        timeStyle: "short"
      }).format(value);
    } catch {
      return value.toISOString();
    }
  }

  private money(value: number, lang: ReportLang) {
    return new Intl.NumberFormat(lang === "ar" ? "ar" : lang === "hi" ? "hi-IN" : lang, {
      style: "currency",
      currency: "USD"
    }).format(value);
  }

  private csvEscape(value: string | number) {
    const text = String(value ?? "");
    return `"${text.replace(/"/g, "\"\"")}"`;
  }

  private statusLabel(lang: ReportLang, status: string) {
    return this.t(lang, status.toLowerCase());
  }

  private resolveRange(query: ReportQueryDto, now = new Date()) {
    const today = now.toISOString().slice(0, 10);
    if (query.quick === "last-day") return { from: today, to: today };
    if (query.quick === "last-week") {
      const start = new Date(now);
      start.setUTCDate(start.getUTCDate() - 6);
      return { from: start.toISOString().slice(0, 10), to: today };
    }
    if (query.quick === "last-month") {
      const start = new Date(now);
      start.setUTCMonth(start.getUTCMonth() - 1);
      return { from: start.toISOString().slice(0, 10), to: today };
    }
    return { from: query.from || today, to: query.to || today };
  }

  async buildRows(user: RequestUser, query: ReportQueryDto = {}): Promise<{ rows: ReportRow[]; range: { from: string; to: string }; lang: ReportLang }> {
    const lang = query.lang || "en";
    const range = this.resolveRange(query);
    const baseWhere: any = {};

    if (user.role === "STORE_OWNER" && user.ownerId) {
      baseWhere.store = { ownerId: user.ownerId, deletedAt: null };
      if (query.storeId) baseWhere.storeId = query.storeId;
      if (query.employeeId) baseWhere.employeeId = query.employeeId;
    } else if (user.managedStoreIds && user.managedStoreIds.length > 0 && user.ownerId) {
      // Per-store manager: reports limited to the stores they manage.
      const managed = user.managedStoreIds;
      if (query.storeId && !managed.includes(query.storeId)) {
        throw new ForbiddenException("That store is outside your admin access.");
      }
      baseWhere.store = { ownerId: user.ownerId, deletedAt: null };
      baseWhere.storeId = query.storeId ? query.storeId : { in: managed };
      if (query.employeeId) baseWhere.employeeId = query.employeeId;
    } else if (user.storeId) {
      if (query.storeId && query.storeId !== user.storeId) throw new ForbiddenException("Employees can only export their assigned store.");
      if (query.employeeId && query.employeeId !== user.employeeId) throw new ForbiddenException("Employees can only export their own closes.");
      baseWhere.storeId = user.storeId;
      if (user.employeeId) baseWhere.employeeId = user.employeeId;
    } else {
      throw new ForbiddenException("Reports require an owner or employee account.");
    }

    // Wide date window; final inclusion is done using each store's timezone.
    const start = new Date(`${range.from}T00:00:00.000Z`);
    start.setUTCDate(start.getUTCDate() - 2);
    const end = new Date(`${range.to}T23:59:59.999Z`);
    end.setUTCDate(end.getUTCDate() + 2);
    baseWhere.date = { gte: start, lte: end };

    const closes = await this.prisma.dailyClose.findMany({
      where: baseWhere,
      include: { store: true, employee: { include: { user: true } } },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }]
    });

    const rows = closes
      .filter((close: any) => {
        const closeDay = this.localDate(close.store.timezone, close.date);
        return closeDay >= range.from && closeDay <= range.to;
      })
      .map((close: any) => {
        const tz = close.store.timezone || "America/New_York";
        return {
          storeName: close.store.storeName,
          employeeName: close.employee?.user?.name || "",
          closeDate: this.localDate(tz, close.date),
          closeTime: this.localTime(tz, close.date, lang),
          totalSales: Number(close.totalSales),
          cashExpected: Number(close.expectedCash),
          cashCounted: Number(close.countedCash),
          difference: Number(close.difference),
          expenses: Number(close.expenses),
          netProfit: netProfit({
            totalSales: Number(close.totalSales),
            tax: Number(close.tax),
            refunds: Number(close.refunds),
            expenses: Number(close.expenses)
          }),
          status: this.statusLabel(lang, close.status),
          notes: close.notes || "",
          completedAt: this.localTime(tz, close.createdAt, lang)
        };
      });

    return { rows, range, lang };
  }

  buildCsv(rows: ReportRow[], lang: ReportLang): string {
    const headers: Array<[keyof ReportRow, string]> = [
      ["storeName", this.t(lang, "store")],
      ["employeeName", this.t(lang, "employee")],
      ["closeDate", this.t(lang, "closeDate")],
      ["closeTime", this.t(lang, "closeTime")],
      ["totalSales", this.t(lang, "totalSales")],
      ["cashExpected", this.t(lang, "cashExpected")],
      ["cashCounted", this.t(lang, "cashCounted")],
      ["difference", this.t(lang, "difference")],
      ["expenses", this.t(lang, "expenses")],
      ["netProfit", this.t(lang, "netProfit")],
      ["status", this.t(lang, "status")],
      ["notes", this.t(lang, "notes")],
      ["completedAt", this.t(lang, "completedAt")]
    ];
    const body = rows.map((row) =>
      headers
        .map(([key]) => {
          const value = row[key];
          const formatted =
            typeof value === "number" && ["totalSales", "cashExpected", "cashCounted", "difference", "expenses", "netProfit"].includes(key)
              ? this.money(value, lang)
              : value;
          return this.csvEscape(formatted);
        })
        .join(",")
    );
    // No UTF-8 BOM: prepending \uFEFF before the first (always-quoted) header
    // cell made spreadsheets render it as garbage (e.g. Google Sheets showed
    // `\u00EE\u203A\u00BF"Store"` in A1, since the BOM sits before the opening quote and can't
    // be stripped). The response is already served as charset=utf-8, so modern
    // Excel/Sheets/Numbers read it correctly without the BOM.
    return `${headers.map(([, label]) => this.csvEscape(label)).join(",")}\n${body.join("\n")}\n`;
  }

  async buildFilteredCsv(user: RequestUser, query: ReportQueryDto): Promise<string> {
    const { rows, lang } = await this.buildRows(user, query);
    return this.buildCsv(rows, lang);
  }

  async buildTodayCsv(user: RequestUser): Promise<string> {
    return this.buildFilteredCsv(user, { quick: "last-day", lang: "en" });
  }

  private pdfText(value: string) {
    // Pre-fix this stripped every non-Latin codepoint to "?" because the
    // PDF was rendered with Helvetica (Latin-only). Now that we embed
    // locale-aware Noto fonts via pdf-fonts.ts, the full Unicode payload
    // can be drawn directly. This pass-through stays as a defensive
    // helper in case a string ever needs sanitising (e.g. control chars).
    return value;
  }

  async buildPdf(user: RequestUser, query: ReportQueryDto): Promise<Uint8Array> {
    const { rows, range, lang } = await this.buildRows(user, query);
    const pdf = await PDFDocument.create();
    // Register fontkit so pdf-lib accepts TTF buffers (Noto Sans variants).
    // Without this, embedFont(buffer) would throw — pdf-lib's built-in
    // embedding only supports the 14 standard PDF fonts.
    pdf.registerFontkit(fontkit);
    const { regular, bold } = await loadFontsForLang(pdf, lang);
    const margin = 42;
    const pageWidth = 612;
    const pageHeight = 792;
    let page = pdf.addPage([pageWidth, pageHeight]);
    let y = pageHeight - margin;

    // Numbers/money always use Latin digits in the PDF — Arabic-locale digits
    // ("Arabic-Indic") render in the wrong order under pdf-lib, which is what
    // made dates/amounts look flipped. Arabic *text* is drawn as-is: pdf-lib
    // has no Arabic shaping engine, and a manual reshaper looked worse than the
    // plain glyphs, so we keep the font's default rendering.
    const pdfMoney = (value: number) =>
      new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
    const cleanDateTime = (d: Date) =>
      new Intl.DateTimeFormat("en-CA", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
      }).format(d);

    const draw = (text: string, x: number, size = 10, font = regular, color = rgb(0.08, 0.12, 0.1)) => {
      page.drawText(this.pdfText(text), { x, y, size, font, color });
    };
    const newPage = () => {
      page = pdf.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    };

    draw(this.t(lang, "title"), margin, 22, bold, rgb(0.12, 0.48, 0.3));
    y -= 28;
    draw(`${this.t(lang, "generated")}: ${cleanDateTime(new Date())}`, margin, 9);
    y -= 15;
    draw(`${this.t(lang, "dateRange")}: ${range.from} - ${range.to}`, margin, 9);
    y -= 28;

    const totalSales = rows.reduce((sum, row) => sum + row.totalSales, 0);
    const totalShort = rows.reduce((sum, row) => sum + Math.min(row.difference, 0), 0);
    const totalNet = rows.reduce((sum, row) => sum + row.netProfit, 0);
    const cards = [
      [this.t(lang, "closes"), String(rows.length)],
      [this.t(lang, "totalSales"), pdfMoney(totalSales)],
      [this.t(lang, "shortage"), pdfMoney(totalShort)],
      [this.t(lang, "netProfit"), pdfMoney(totalNet)]
    ];
    cards.forEach(([label, value], index) => {
      const x = margin + index * 132;
      page.drawRectangle({ x, y: y - 48, width: 120, height: 48, color: rgb(0.95, 0.96, 0.93) });
      page.drawText(this.pdfText(label), { x: x + 8, y: y - 18, size: 8, font: bold, color: rgb(0.42, 0.46, 0.43) });
      page.drawText(this.pdfText(value), { x: x + 8, y: y - 38, size: 13, font: bold, color: rgb(0.08, 0.12, 0.1) });
    });
    y -= 72;

    // Group closes by store so the report reads store-by-store instead of one
    // mixed list. Rows stay newest-first within each store (buildRows sorts by
    // date desc); stores appear in first-seen order.
    const groups = new Map<string, typeof rows>();
    for (const row of rows) {
      if (!groups.has(row.storeName)) groups.set(row.storeName, []);
      groups.get(row.storeName)!.push(row);
    }

    // The store name is now a section heading, so the per-store table drops the
    // Store column and gains Net Profit.
    const colHeaders = [
      this.t(lang, "closeDate"),
      this.t(lang, "totalSales"),
      this.t(lang, "expenses"),
      this.t(lang, "difference"),
      this.t(lang, "netProfit"),
      this.t(lang, "status")
    ];
    const widths = [95, 90, 85, 85, 90, 67];
    const xPositions = widths.reduce<number[]>((acc, width, index) => {
      acc.push(index === 0 ? margin : acc[index - 1] + widths[index - 1]);
      return acc;
    }, []);

    const drawColHeader = () => {
      page.drawRectangle({ x: margin, y: y - 16, width: pageWidth - margin * 2, height: 20, color: rgb(0.94, 0.92, 0.88) });
      colHeaders.forEach((header, i) => page.drawText(this.pdfText(header), { x: xPositions[i] + 4, y: y - 11, size: 8, font: bold }));
      y -= 24;
    };
    const drawStoreHeading = (name: string) => {
      page.drawText(this.pdfText(name), { x: margin, y, size: 13, font: bold, color: rgb(0.12, 0.48, 0.3) });
      y -= 18;
    };

    for (const [storeName, storeRows] of groups) {
      // Don't strand a store heading at the very bottom of a page.
      if (y < 130) newPage();
      drawStoreHeading(storeName);
      drawColHeader();

      let storeSales = 0;
      let storeShort = 0;
      for (const row of storeRows) {
        if (y < 64) {
          newPage();
          drawStoreHeading(storeName);
          drawColHeader();
        }
        storeSales += row.totalSales;
        storeShort += Math.min(row.difference, 0);
        const values = [
          row.closeDate,
          pdfMoney(row.totalSales),
          pdfMoney(row.expenses),
          pdfMoney(row.difference),
          pdfMoney(row.netProfit),
          row.status
        ];
        values.forEach((value, i) => page.drawText(this.pdfText(value), { x: xPositions[i] + 4, y, size: 8, font: regular }));
        y -= 16;
        if (row.notes) {
          page.drawText(this.pdfText(`${this.t(lang, "notes")}: ${row.notes}`).slice(0, 110), {
            x: margin + 8,
            y,
            size: 7,
            font: regular,
            color: rgb(0.36, 0.39, 0.37)
          });
          y -= 13;
        }
      }

      // Per-store subtotal line.
      y -= 2;
      const subtotal = `${this.t(lang, "closes")}: ${storeRows.length}     ${this.t(lang, "totalSales")}: ${pdfMoney(storeSales)}     ${this.t(lang, "shortage")}: ${pdfMoney(storeShort)}`;
      page.drawText(this.pdfText(subtotal), { x: margin + 4, y, size: 8, font: bold, color: rgb(0.42, 0.46, 0.43) });
      y -= 26;
    }

    page.drawText("Daily Close", { x: margin, y: 28, size: 8, font: bold, color: rgb(0.12, 0.48, 0.3) });
    return pdf.save();
  }

  private sanitizeFilenameSegment(value: string): string {
    return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "receipt";
  }

  private guessExt(imageUrl: string, storagePath: string | null): string {
    const source = storagePath || imageUrl || "";
    const match = source.match(/\.([a-zA-Z0-9]{2,5})(?:\?|$)/);
    if (match) return match[1].toLowerCase();
    return "jpg";
  }

  private pairUnlinkedReceiptRows(
    rows: any[],
    closes: any[]
  ): Array<{ row: any; dailyClose: any | null }> {
    const linked = rows
      .filter((row) => row.dailyClose)
      .map((row) => ({ row, dailyClose: row.dailyClose }));
    const linkedCloseIds = new Set(linked.map((entry) => entry.dailyClose.id));
    const usedUploadIds = new Set(linked.map((entry) => entry.row.id));
    const unlinked = rows
      .filter((row) => !row.dailyClose)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const matched: Array<{ row: any; dailyClose: any | null }> = [];
    const windowMs = 8 * 60 * 60 * 1000;

    for (const close of closes) {
      if (linkedCloseIds.has(close.id)) continue;
      const closeCreatedAt = close.createdAt ?? close.date;
      const match = unlinked.find((row) => {
        if (usedUploadIds.has(row.id)) return false;
        if (row.storeId !== close.storeId) return false;
        if (row.uploadedByUserId && row.uploadedByUserId !== close.submittedByUserId) return false;
        const diff = closeCreatedAt.getTime() - row.createdAt.getTime();
        return diff >= 0 && diff <= windowMs;
      });
      if (match) {
        usedUploadIds.add(match.id);
        matched.push({ row: match, dailyClose: close });
      }
    }

    return [...linked, ...matched].sort(
      (a, b) => b.row.createdAt.getTime() - a.row.createdAt.getTime()
    );
  }

  /**
   * Owner-only single-receipt download. Returns a Buffer + filename so the
   * controller can stream it as an attachment. Falls back to a redirect URL
   * (the live signed URL) when the file can't be fetched directly — for
   * example when SUPABASE creds aren't configured in the env.
   */
  async downloadReceipt(id: string, user: RequestUser): Promise<{
    filename: string;
    buffer: Buffer | null;
    redirectUrl: string | null;
    contentType: string;
  }> {
    // Owners + per-store managers (scoped to their stores) can download.
    const scope = resolveAdminScope(user);
    const row = await this.prisma.uploadedReport.findFirst({
      where: { id, store: storeWhereForScope(scope) },
      include: { store: true, dailyClose: true }
    });
    if (!row || !row.store) throw new NotFoundException("Receipt not found.");

    const tz = row.store.timezone || "America/New_York";
    const dateStr = row.dailyClose
      ? this.localDate(tz, row.dailyClose.date)
      : this.localDate(tz, row.createdAt);
    const ext = this.guessExt(row.imageUrl, row.storagePath);
    const filename = `receipt-${this.sanitizeFilenameSegment(row.store.storeName)}-${dateStr}-${row.id}.${ext}`;
    const contentType = ext === "png" ? "image/png" : ext === "pdf" ? "application/pdf" : "image/jpeg";

    if (row.storagePath && this.storage) {
      // Both storage calls must be guarded: a missing/expired object makes
      // them THROW, not just return null. An uncaught throw here surfaces to
      // the client as a 500 "internal error" instead of a graceful fallback.
      try {
        const buf = await this.storage.download(row.storagePath);
        if (buf) return { filename, buffer: buf, redirectUrl: null, contentType };
      } catch (err: any) {
        this.logger.warn(`Receipt storage download failed (${row.id}): ${err?.message || err}`);
      }
      try {
        const fresh = await this.storage.signPath(row.storagePath, 300);
        if (fresh) return { filename, buffer: null, redirectUrl: fresh, contentType };
      } catch (err: any) {
        this.logger.warn(`Receipt re-sign failed (${row.id}): ${err?.message || err}`);
      }
    }
    // No storage path / no storage configured / all storage calls failed:
    // 302 to the last-known stored URL (may be an expired signed URL, but a
    // redirect is a far cleaner failure than a 500).
    return { filename, buffer: null, redirectUrl: row.imageUrl, contentType };
  }

  /**
   * Owner-only bulk receipt download. Returns the list of objects to zip;
   * the controller streams them via archiver. Returns receipts within the
   * same filter window as listReceipts.
   */
  async listReceiptsForDownload(query: ReceiptsQueryDto, user: RequestUser): Promise<{
    storeName: string;
    items: Array<{ filename: string; storagePath: string | null; imageUrl: string }>;
  }> {
    const scope = resolveAdminScope(user);
    if (!query.storeId || !scopeAllowsStore(scope, query.storeId)) {
      throw new ForbiddenException("This store is not yours.");
    }
    const store = await this.prisma.store.findFirst({
      where: { id: query.storeId, ownerId: scope.ownerId, deletedAt: null },
      select: { id: true, storeName: true, timezone: true }
    });
    if (!store) throw new ForbiddenException("This store is not yours.");

    const tz = store.timezone || "America/New_York";
    const today = DashboardService.formatLocalDate(new Date(), tz);
    const fromStr = query.from || (() => {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - 7);
      return DashboardService.formatLocalDate(d, tz);
    })();
    const toStr = query.to || today;
    const fromRange = DashboardService.storeLocalDayRange(tz, new Date(`${fromStr}T12:00:00Z`));
    const toRange = DashboardService.storeLocalDayRange(tz, new Date(`${toStr}T12:00:00Z`));

    const rows = await this.prisma.uploadedReport.findMany({
      where: {
        OR: [
          { dailyClose: { storeId: store.id, date: { gte: fromRange.start, lte: toRange.end } } },
          {
            dailyCloseId: null,
            storeId: store.id,
            createdAt: { gte: fromRange.start, lte: toRange.end }
          }
        ]
      },
      include: { dailyClose: true },
      orderBy: { createdAt: "desc" },
      take: 200
    });
    const closes = await this.prisma.dailyClose.findMany({
      where: { storeId: store.id, date: { gte: fromRange.start, lte: toRange.end } },
      orderBy: { createdAt: "desc" }
    });
    const receiptRows = this.pairUnlinkedReceiptRows(rows, closes);

    const items = receiptRows.map(({ row, dailyClose }) => {
      const dateStr = dailyClose
        ? this.localDate(tz, dailyClose.date)
        : this.localDate(tz, row.createdAt);
      const ext = this.guessExt(row.imageUrl, row.storagePath);
      // Two folders in the zip — closes/ and expenses/ — so the owner can tell
      // sales receipts from photographed expense documents at a glance.
      const isExpense = receiptKind(row) === "expense";
      const folder = isExpense ? "expenses" : "closes";
      const prefix = isExpense ? "expense" : "receipt";
      return {
        filename: `${folder}/${prefix}-${this.sanitizeFilenameSegment(store.storeName)}-${dateStr}-${row.id}.${ext}`,
        storagePath: row.storagePath,
        imageUrl: row.imageUrl
      };
    });
    return { storeName: store.storeName, items };
  }

  /**
   * Owner-only: list POS-report uploads for one of the owner's stores within
   * a date range. Employees cannot call this — they only see their own close
   * flow, not the historical receipts grid.
   */
  async listReceipts(query: ReceiptsQueryDto, user: RequestUser) {
    // Owners + per-store managers (scoped to their stores) can view receipts.
    const scope = resolveAdminScope(user);
    if (!query.storeId || !scopeAllowsStore(scope, query.storeId)) {
      throw new ForbiddenException("This store is not yours.");
    }
    const store = await this.prisma.store.findFirst({
      where: { id: query.storeId, ownerId: scope.ownerId, deletedAt: null },
      select: { id: true, storeName: true, timezone: true }
    });
    if (!store) throw new ForbiddenException("This store is not yours.");

    // Default to last 7 days in the store's local timezone if no range given.
    const tz = store.timezone || "America/New_York";
    const today = DashboardService.formatLocalDate(new Date(), tz);
    const fromStr = query.from || (() => {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - 7);
      return DashboardService.formatLocalDate(d, tz);
    })();
    const toStr = query.to || today;

    const fromRange = DashboardService.storeLocalDayRange(tz, new Date(`${fromStr}T12:00:00Z`));
    const toRange = DashboardService.storeLocalDayRange(tz, new Date(`${toStr}T12:00:00Z`));

    const rows = await this.prisma.uploadedReport.findMany({
      where: {
        OR: [
          { dailyClose: { storeId: store.id, date: { gte: fromRange.start, lte: toRange.end } } },
          {
            dailyCloseId: null,
            storeId: store.id,
            createdAt: { gte: fromRange.start, lte: toRange.end }
          }
        ]
      },
      include: {
        dailyClose: {
          include: { submittedBy: true }
        },
        uploadedBy: true
      },
      orderBy: { createdAt: "desc" },
      take: 200
    });
    const closes = await this.prisma.dailyClose.findMany({
      where: { storeId: store.id, date: { gte: fromRange.start, lte: toRange.end } },
      include: { submittedBy: true },
      orderBy: { createdAt: "desc" }
    });
    const receiptRows = this.pairUnlinkedReceiptRows(rows, closes);

    // Mint a fresh short-lived signed URL for any row that has a
    // storagePath. The stored imageUrl is a 7-day signed URL and breaks
    // once it expires; storagePath never does. Done in parallel to keep
    // p95 acceptable even on large pages.
    const signed = await Promise.all(
      receiptRows.map(async ({ row }) =>
        row.storagePath && this.storage
          ? await this.storage.signPath(row.storagePath, 3600)
          : null
      )
    );

    return receiptRows.map(({ row, dailyClose }, idx: number) => {
      const dc = dailyClose;
      const employeeName = row.uploadedBy?.name ?? dc?.submittedBy?.name ?? "";
      const closeDate = dc ? this.localDate(tz, dc.date) : this.localDate(tz, row.createdAt);
      return {
        id: row.id,
        imageUrl: signed[idx] || row.imageUrl,
        storeName: store.storeName,
        closeDate,
        employeeName,
        kind: receiptKind(row),
        parsedJson: row.parsedJson,
        dailyClose: dc
          ? {
              id: dc.id,
              totalSales: Number(dc.totalSales),
              cashSales: Number(dc.cashSales),
              cardSales: Number(dc.cardSales),
              difference: Number(dc.difference),
              status: dc.status
            }
          : null,
        createdAt: row.createdAt.toISOString()
      };
    });
  }
}

// Whether an UploadedReport is a close/sales receipt or a photographed expense
// document. Expense uploads are tagged with parserType "EXPENSE" (and a
// parsedJson.kind marker); everything else — including legacy rows — is a close.
export function receiptKind(row: { parserType?: string | null; parsedJson?: unknown }): "close" | "expense" {
  if (row.parserType === "EXPENSE") return "expense";
  const pj = row.parsedJson;
  if (pj && typeof pj === "object" && (pj as { kind?: string }).kind === "expense") return "expense";
  return "close";
}

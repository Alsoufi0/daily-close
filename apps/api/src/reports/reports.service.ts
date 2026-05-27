import { ForbiddenException, Injectable } from "@nestjs/common";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { loadFontsForLang } from "./pdf-fonts";
import { RequestUser } from "../auth/request-user";
import { DashboardService } from "../dashboard/dashboard.service";
import { PrismaService } from "../prisma/prisma.service";
import { ReportQueryDto } from "./dto/report-query.dto";

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
  constructor(
    private readonly dashboard: DashboardService,
    private readonly prisma: PrismaService
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

    if (user.ownerId) {
      baseWhere.store = { ownerId: user.ownerId, deletedAt: null };
      if (query.storeId) baseWhere.storeId = query.storeId;
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
      ["status", this.t(lang, "status")],
      ["notes", this.t(lang, "notes")],
      ["completedAt", this.t(lang, "completedAt")]
    ];
    const body = rows.map((row) =>
      headers
        .map(([key]) => {
          const value = row[key];
          const formatted =
            typeof value === "number" && ["totalSales", "cashExpected", "cashCounted", "difference", "expenses"].includes(key)
              ? this.money(value, lang)
              : value;
          return this.csvEscape(formatted);
        })
        .join(",")
    );
    return `\uFEFF${headers.map(([, label]) => this.csvEscape(label)).join(",")}\n${body.join("\n")}\n`;
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

    const draw = (text: string, x: number, size = 10, font = regular, color = rgb(0.08, 0.12, 0.1)) => {
      page.drawText(this.pdfText(text), { x, y, size, font, color });
    };
    const newPage = () => {
      page = pdf.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    };

    draw(this.t(lang, "title"), margin, 22, bold, rgb(0.12, 0.48, 0.3));
    y -= 28;
    draw(`${this.t(lang, "generated")}: ${new Date().toISOString()}`, margin, 9);
    y -= 15;
    draw(`${this.t(lang, "dateRange")}: ${range.from} - ${range.to}`, margin, 9);
    y -= 28;

    const totalSales = rows.reduce((sum, row) => sum + row.totalSales, 0);
    const totalShort = rows.reduce((sum, row) => sum + Math.min(row.difference, 0), 0);
    const cards = [
      [this.t(lang, "closes"), String(rows.length)],
      [this.t(lang, "totalSales"), this.money(totalSales, lang)],
      [this.t(lang, "shortage"), this.money(totalShort, lang)]
    ];
    cards.forEach(([label, value], index) => {
      const x = margin + index * 172;
      page.drawRectangle({ x, y: y - 48, width: 156, height: 48, color: rgb(0.95, 0.96, 0.93) });
      page.drawText(this.pdfText(label), { x: x + 10, y: y - 18, size: 8, font: bold, color: rgb(0.42, 0.46, 0.43) });
      page.drawText(this.pdfText(value), { x: x + 10, y: y - 38, size: 14, font: bold, color: rgb(0.08, 0.12, 0.1) });
    });
    y -= 72;

    const headers = [this.t(lang, "store"), this.t(lang, "closeDate"), this.t(lang, "totalSales"), this.t(lang, "difference"), this.t(lang, "status")];
    const widths = [170, 95, 95, 95, 95];
    const xPositions = widths.reduce<number[]>((acc, width, index) => {
      acc.push(index === 0 ? margin : acc[index - 1] + widths[index - 1]);
      return acc;
    }, []);

    const drawHeader = () => {
      page.drawRectangle({ x: margin, y: y - 18, width: pageWidth - margin * 2, height: 22, color: rgb(0.94, 0.92, 0.88) });
      headers.forEach((header, i) => page.drawText(this.pdfText(header), { x: xPositions[i] + 4, y: y - 12, size: 8, font: bold }));
      y -= 28;
    };
    drawHeader();

    for (const row of rows) {
      if (y < 72) {
        newPage();
        drawHeader();
      }
      const values = [
        row.storeName.slice(0, 28),
        row.closeDate,
        this.money(row.totalSales, lang),
        this.money(row.difference, lang),
        row.status
      ];
      values.forEach((value, i) => page.drawText(this.pdfText(value), { x: xPositions[i] + 4, y, size: 8, font: regular }));
      y -= 18;
      if (row.notes) {
        page.drawText(this.pdfText(`${this.t(lang, "notes")}: ${row.notes}`).slice(0, 105), {
          x: margin + 4,
          y,
          size: 7,
          font: regular,
          color: rgb(0.36, 0.39, 0.37)
        });
        y -= 14;
      }
    }

    page.drawText(this.pdfText("Daily Close"), { x: margin, y: 28, size: 8, font: bold, color: rgb(0.12, 0.48, 0.3) });
    return pdf.save();
  }
}

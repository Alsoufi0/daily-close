import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException
} from "@nestjs/common";
import type { DailyCloseResult, ParsedPOSReport } from "@shared/types";
import { OCRService } from "../ocr/ocr.service";
import { PosParserService } from "../pos-parsers/pos-parser.service";
import { RequestUser } from "../auth/request-user";
import { SupabaseStorageService } from "../supabase/supabase-storage.service";
import { CreateDailyCloseDto } from "./dto/create-daily-close.dto";
import { ScanReportDto } from "./dto/scan-report.dto";
import { UploadReportDto } from "./dto/upload-report.dto";
import { DailyCloseRepository } from "./daily-close.repository";
import { PrismaService } from "../prisma/prisma.service";
import { DashboardService } from "../dashboard/dashboard.service";
import { NotificationsService } from "../notifications/notifications.service";
import { WhatsAppService } from "../notifications/whatsapp.service";

@Injectable()
export class DailyCloseService {
  private readonly logger = new Logger(DailyCloseService.name);

  constructor(
    private readonly repository: DailyCloseRepository,
    private readonly posParser: PosParserService,
    @Inject("OCRService") private readonly ocr: OCRService,
    private readonly storage: SupabaseStorageService,
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly whatsapp: WhatsAppService
  ) {}

  async scanReport(input: ScanReportDto): Promise<ParsedPOSReport & { rawText?: string }> {
    let text = "";
    try {
      text = await this.ocr.extractText(input.imageUrl);
    } catch (err: any) {
      this.logger.warn(`OCR failed, returning manual-entry result: ${err?.message || err}`);
    }
    const parsed = this.posParser.parse(text);
    // If the parser couldn't extract anything useful, pass the raw OCR text
    // back so the UI can show the employee what was actually read off the
    // receipt — way better than a silent "Photo saved, enter numbers".
    const found = (parsed.cashSales || 0) + (parsed.cardSales || 0) + (parsed.totalSales || 0);
    return found > 0 ? parsed : { ...parsed, rawText: text.slice(0, 4000) };
  }

  async debugOcr(input: ScanReportDto, user: RequestUser) {
    if (user.role !== "STORE_OWNER") {
      throw new ForbiddenException("Owner-only diagnostic.");
    }
    const text = await this.ocr.extractText(input.imageUrl);
    const parsed = this.posParser.parse(text);
    return {
      ocrProvider: (this.ocr as any).constructor?.name ?? "unknown",
      rawTextLength: text.length,
      rawTextPreview: text.slice(0, 1500),
      parsed
    };
  }

  async uploadReport(input: UploadReportDto, user: RequestUser): Promise<ParsedPOSReport & { imageUrl: string }> {
    await this.assertCanCloseStore(user, input.storeId);

    let imageUrl = input.imageUrl;
    if (input.base64Data) {
      try {
        imageUrl = await this.storage.uploadBase64(
            `${input.storeId}/${Date.now()}-${input.fileName}`,
            input.base64Data,
            input.contentType
          );
      } catch (err: any) {
        // Storage should not block closing. OCR can read the data URL directly,
        // and the employee can still confirm/edit the parsed numbers.
        this.logger.warn(`POS report storage failed, continuing with OCR only: ${err?.message || err}`);
        imageUrl = "report-upload-not-stored";
      }
    }

    const imageForOcr = input.base64Data || imageUrl;
    if (!imageForOcr) throw new BadRequestException("Report image is required.");

    const parsed = await this.scanReport({ imageUrl: imageForOcr, storeId: input.storeId });
    return { ...parsed, imageUrl } as ParsedPOSReport & { imageUrl: string };
  }

  async finishClosing(input: CreateDailyCloseDto, user?: RequestUser): Promise<DailyCloseResult> {
    let resolvedEmployeeId = input.employeeId;
    if (user) {
      resolvedEmployeeId = await this.assertCanCloseStore(user, input.storeId);
    }

    const eventDate = new Date(input.date);
    const store = await this.prisma.store.findUnique({
      where: { id: input.storeId },
      select: { timezone: true }
    });
    const { start, end } = DashboardService.storeLocalDayRange(
      store?.timezone || "America/New_York",
      eventDate
    );
    const existing = await this.repository.findByStoreAndRange(input.storeId, start, end);
    if (existing) throw new BadRequestException("This store is already closed for this date.");

    const expectedCash = input.cashSales - input.refunds - input.expenses;
    const difference = input.countedCash + input.safeDropAmount - expectedCash;
    const status = this.getStatus(difference);

    // safeDropAmount is part of the DTO for shortage math only — it is NOT a
    // column on DailyClose, so it must be stripped before the Prisma create.
    const { safeDropAmount: _safeDropAmount, date: _date, employeeId: _eid, ...persisted } = input;
    const created = await this.repository.create({
      ...persisted,
      employeeId: resolvedEmployeeId,
      date: eventDate,
      expectedCash,
      difference,
      status
    });

    if (user) {
      await this.repository.createExpenseAndAudit({
        dailyCloseId: created.id,
        storeId: input.storeId,
        userId: user.id,
        expenses: input.expenses,
        notes: input.notes,
        difference
      });
    }

    await this.sendCloseCompletedWhatsApp(input.storeId);

    return {
      id: created.id,
      expectedCash,
      countedCash: input.countedCash,
      difference,
      status,
      createdAt: created.createdAt.toISOString()
    };
  }

  async editClosing(
    id: string,
    patch: Record<string, any>,
    user: RequestUser
  ) {
    if (user.role !== "STORE_OWNER" || !user.ownerId) {
      throw new ForbiddenException("Only owners can edit a submitted close.");
    }
    const existing = await this.repository.findByIdForOwner(id, user.ownerId);
    if (!existing) throw new NotFoundException("Close not found.");

    const merged = {
      cashSales: Number(patch.cashSales ?? existing.cashSales),
      cardSales: Number(patch.cardSales ?? existing.cardSales),
      totalSales: Number(patch.totalSales ?? existing.totalSales),
      tax: Number(patch.tax ?? existing.tax),
      refunds: Number(patch.refunds ?? existing.refunds),
      discounts: Number(patch.discounts ?? existing.discounts),
      lottery: patch.lottery !== undefined ? Number(patch.lottery) : existing.lottery ? Number(existing.lottery) : null,
      countedCash: Number(patch.countedCash ?? existing.countedCash),
      safeDropAmount: Number(patch.safeDropAmount ?? 0),
      expenses: Number(patch.expenses ?? existing.expenses),
      notes: (patch.notes as string | undefined) ?? existing.notes ?? undefined
    };

    const expectedCash = merged.cashSales - merged.refunds - merged.expenses;
    const difference = merged.countedCash + merged.safeDropAmount - expectedCash;
    const status = this.getStatus(difference);

    const updated = await this.repository.updateClose(id, {
      cashSales: merged.cashSales,
      cardSales: merged.cardSales,
      totalSales: merged.totalSales,
      tax: merged.tax,
      refunds: merged.refunds,
      discounts: merged.discounts,
      lottery: merged.lottery,
      countedCash: merged.countedCash,
      expectedCash,
      difference,
      expenses: merged.expenses,
      notes: merged.notes,
      status
    });

    await this.repository.writeAudit({
      userId: user.id,
      storeId: existing.storeId,
      action: "daily_close.edited",
      metadata: { dailyCloseId: id, patch, newStatus: status, difference }
    });

    return {
      id: updated.id,
      expectedCash,
      countedCash: merged.countedCash,
      difference,
      status,
      createdAt: updated.createdAt.toISOString()
    };
  }

  async deleteClosing(id: string, user: RequestUser) {
    if (user.role !== "STORE_OWNER" || !user.ownerId) {
      throw new ForbiddenException("Only owners can delete a submitted close.");
    }
    const existing = await this.repository.findByIdForOwner(id, user.ownerId);
    if (!existing) throw new NotFoundException("Close not found.");

    const deleted = await this.repository.deleteClose(id);
    await this.repository.writeAudit({
      userId: user.id,
      storeId: existing.storeId,
      action: "daily_close.deleted",
      metadata: { dailyCloseId: id }
    });

    return { id: deleted.id, deleted: true };
  }

  private getStatus(difference: number): "CLOSED" | "SHORT" | "OVER" {
    if (difference < 0) return "SHORT";
    if (difference > 0) return "OVER";
    return "CLOSED";
  }

  private assertEmployeeStore(user: RequestUser, storeId: string) {
    if (user.role !== "EMPLOYEE") throw new ForbiddenException("Only employees can submit daily closes.");
    if (user.storeId !== storeId) throw new ForbiddenException("Employee cannot close another store.");
    if (!user.employeeId) throw new ForbiddenException("Employee profile is incomplete.");
  }

  private async sendCloseCompletedWhatsApp(storeId: string) {
    try {
      const store = await this.prisma.store.findUnique({
        where: { id: storeId },
        select: {
          storeName: true,
          ownerId: true,
          owner: { select: { user: { select: { name: true } } } }
        }
      });
      if (!store) return;
      const prefs = await this.notifications.getOwnerWhatsAppPreferences(store.ownerId);
      if (!prefs.closeAlertsEnabled || !prefs.phone || !this.whatsapp.isConfigured()) return;
      await this.whatsapp.sendCloseCompletedTemplate({
        toPhone: prefs.phone,
        ownerName: store.owner.user.name,
        storeName: store.storeName
      });
    } catch (err: any) {
      this.logger.warn(`Close-completed WhatsApp alert skipped: ${err?.message || err}`);
    }
  }

  // Allows owners (for stores they own) and employees (for their store).
  // For owners, finds or creates an Employee row tying the owner's User to the
  // target store so the close has a valid employeeId FK.
  private async assertCanCloseStore(user: RequestUser, storeId: string): Promise<string> {
    if (user.role === "EMPLOYEE") {
      if (user.storeId !== storeId) throw new ForbiddenException("Employee cannot close another store.");
      if (!user.employeeId) throw new ForbiddenException("Employee profile is incomplete.");
      return user.employeeId;
    }
    if (user.role === "STORE_OWNER" && user.ownerId) {
      const store = await this.prisma.store.findFirst({
        where: { id: storeId, ownerId: user.ownerId, deletedAt: null },
        select: { id: true }
      });
      if (!store) throw new ForbiddenException("This store is not yours.");
      // Get-or-create an owner-as-employee row so we satisfy the FK.
      let employee = await this.prisma.employee.findFirst({
        where: { userId: user.id, storeId, deletedAt: null }
      });
      if (!employee) {
        employee = await this.prisma.employee.create({
          data: { userId: user.id, storeId }
        });
      }
      return employee.id;
    }
    throw new ForbiddenException("Not allowed to close this store.");
  }
}

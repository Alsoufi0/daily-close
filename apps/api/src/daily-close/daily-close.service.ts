import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
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

@Injectable()
export class DailyCloseService {
  constructor(
    private readonly repository: DailyCloseRepository,
    private readonly posParser: PosParserService,
    @Inject("OCRService") private readonly ocr: OCRService,
    private readonly storage: SupabaseStorageService,
    private readonly prisma: PrismaService
  ) {}

  async scanReport(input: ScanReportDto): Promise<ParsedPOSReport> {
    const text = await this.ocr.extractText(input.imageUrl);
    return this.posParser.parse(text);
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

    const imageUrl = input.base64Data
      ? await this.storage.uploadBase64(
          `${input.storeId}/${Date.now()}-${input.fileName}`,
          input.base64Data,
          input.contentType
        )
      : input.imageUrl;

    if (!imageUrl) throw new BadRequestException("Report image is required.");

    const parsed = await this.scanReport({ imageUrl, storeId: input.storeId });
    return { ...parsed, imageUrl };
  }

  async finishClosing(input: CreateDailyCloseDto, user?: RequestUser): Promise<DailyCloseResult> {
    let resolvedEmployeeId = input.employeeId;
    if (user) {
      resolvedEmployeeId = await this.assertCanCloseStore(user, input.storeId);
    }

    const existing = await this.repository.findByStoreAndDate(input.storeId, new Date(input.date));
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
      date: new Date(input.date),
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
        where: { id: storeId, ownerId: user.ownerId },
        select: { id: true }
      });
      if (!store) throw new ForbiddenException("This store is not yours.");
      // Get-or-create an owner-as-employee row so we satisfy the FK.
      let employee = await this.prisma.employee.findFirst({
        where: { userId: user.id, storeId }
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

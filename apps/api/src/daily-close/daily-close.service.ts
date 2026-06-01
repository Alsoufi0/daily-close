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
import { assertScopeAllowsStore, resolveAdminScope } from "../auth/admin-scope";
import { SupabaseStorageService } from "../supabase/supabase-storage.service";
import { CreateDailyCloseDto } from "./dto/create-daily-close.dto";
import { ScanReportDto } from "./dto/scan-report.dto";
import { UploadReportDto } from "./dto/upload-report.dto";
import { DailyCloseRepository } from "./daily-close.repository";
import { PrismaService } from "../prisma/prisma.service";
import { DashboardService } from "../dashboard/dashboard.service";
import { NotificationsService } from "../notifications/notifications.service";
import { SmsService } from "../notifications/sms.service";
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
    private readonly whatsapp: WhatsAppService,
    private readonly sms: SmsService
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
    let storagePath: string | null = null;
    if (input.base64Data) {
      try {
        const uploaded = await this.storage.uploadBase64(
            `${input.storeId}/${Date.now()}-${input.fileName}`,
            input.base64Data,
            input.contentType
          );
        // Tests historically mocked uploadBase64() as returning a bare URL
        // string; handle both the new {storagePath, signedUrl} object and
        // the legacy string return so old fixtures keep passing.
        if (typeof uploaded === "string") {
          imageUrl = uploaded;
        } else {
          imageUrl = uploaded.signedUrl;
          storagePath = uploaded.storagePath;
        }
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

    // Persist the upload so the owner Receipts page can show it. The row is
    // intentionally created BEFORE finishClosing — daily_close_id stays null
    // until the close lands (it's never reverse-linked, but joining via
    // store + created_at is enough for the Receipts UI).
    try {
      await this.prisma.uploadedReport.create({
        data: {
          imageUrl: imageUrl || "report-upload-not-stored",
          storagePath,
          parsedJson: parsed as any,
          parserType: parsed.parserType || "UNKNOWN",
          storeId: input.storeId,
          uploadedByUserId: user.id
        }
      });
    } catch (err: any) {
      // The Receipts page is a read-only owner feature; failing to persist
      // here must not block the employee's close. Log and move on.
      this.logger.warn(`UploadedReport persist failed (non-fatal): ${err?.message || err}`);
    }

    return { ...parsed, imageUrl } as ParsedPOSReport & { imageUrl: string };
  }

  async finishClosing(
    input: CreateDailyCloseDto,
    user?: RequestUser,
    idempotencyKey?: string
  ): Promise<DailyCloseResult> {
    // Idempotency check (audit fix #3). When the client provides an
    // Idempotency-Key header and we have already persisted a close with that
    // key, return the original result and skip all side effects (no second
    // expense row, no second audit log, no second WhatsApp). Wrapped in a
    // defensive try/catch so the API still works if the 005 migration that
    // adds the `idempotency_key` column has not yet been applied — in that
    // case we log a warning and fall through to non-idempotent behaviour.
    if (idempotencyKey) {
      try {
        const prior = await this.repository.findByIdempotencyKey(idempotencyKey);
        if (prior) {
          return {
            id: prior.id,
            expectedCash: Number(prior.expectedCash),
            countedCash: Number(prior.countedCash),
            difference: Number(prior.difference),
            status: prior.status,
            createdAt: prior.createdAt.toISOString()
          };
        }
      } catch (err: any) {
        const msg = String(err?.message || err);
        // Only swallow the specific "column does not exist" error that the
        // pre-005 schema produces. Anything else (connection error, etc.)
        // we want to re-throw.
        if (/idempotency_key/.test(msg) && /(does not exist|undefined column)/i.test(msg)) {
          this.logger.warn(
            "Idempotency check skipped: migration 005_daily_close_idempotency.sql has not been applied yet. Apply it and redeploy."
          );
        } else {
          throw err;
        }
      }
    }

    // Resolve who's closing this. Post migration 006 both pieces of
    // information are kept on the close row:
    //   - employeeId: the assignment row (kept for back-compat with
    //     existing report joins; nullable when no row exists yet).
    //   - submittedByUserId: the actual user — this is the new source
    //     of truth for "who submitted this close" and is always set.
    let resolvedEmployeeId: string | null = input.employeeId;
    let submittedByUserId: string | undefined = user?.id;
    if (user) {
      resolvedEmployeeId = await this.assertCanCloseStore(user, input.storeId);
    }
    if (!submittedByUserId) {
      // Test/system fallback: try to derive the user from the input's
      // employeeId. Real requests always have a user via SupabaseAuthGuard.
      throw new BadRequestException("Close submission requires an authenticated user.");
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

    // When the client sends an itemized breakdown, the items are the source
    // of truth and the cached `expenses` total is recomputed from them. This
    // keeps the expense rows and the rolled-up Decimal on DailyClose
    // consistent even if a stale `expenses` value is sent.
    const items = input.expenseItems && input.expenseItems.length > 0 ? input.expenseItems : undefined;
    const expensesTotal = items
      ? items.reduce((sum, item) => sum + Number(item.amount || 0), 0)
      : input.expenses;

    const expectedCash = input.cashSales - input.refunds - expensesTotal;
    const difference = input.countedCash + input.safeDropAmount - expectedCash;
    const status = this.getStatus(difference);

    // safeDropAmount is part of the DTO for shortage math only — it is NOT a
    // column on DailyClose, so it must be stripped before the Prisma create.
    const {
      safeDropAmount: _safeDropAmount,
      date: _date,
      employeeId: _eid,
      expenseItems: _items,
      expenses: _expenses,
      ...persisted
    } = input;
    const created = await this.repository.create({
      ...persisted,
      expenses: expensesTotal,
      employeeId: resolvedEmployeeId,
      submittedByUserId,
      date: eventDate,
      expectedCash,
      difference,
      status,
      idempotencyKey
    });

    if (user) {
      await this.repository.createExpenseAndAudit({
        dailyCloseId: created.id,
        storeId: input.storeId,
        userId: user.id,
        expenses: expensesTotal,
        notes: input.notes,
        difference,
        expenseItems: items
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
    // Account owners + per-store managers (scoped to their stores) can edit.
    const scope = resolveAdminScope(user);
    const existing = await this.repository.findByIdForOwner(id, scope.ownerId);
    if (!existing) throw new NotFoundException("Close not found.");
    assertScopeAllowsStore(scope, existing.storeId);

    const existingExpectedCash = Number(existing.expectedCash ?? (Number(existing.cashSales) - Number(existing.refunds) - Number(existing.expenses)));
    const existingSafeDropAmount = Number(existing.difference ?? 0) + existingExpectedCash - Number(existing.countedCash);

    const merged = {
      cashSales: Number(patch.cashSales ?? existing.cashSales),
      cardSales: Number(patch.cardSales ?? existing.cardSales),
      totalSales: Number(patch.totalSales ?? existing.totalSales),
      tax: Number(patch.tax ?? existing.tax),
      refunds: Number(patch.refunds ?? existing.refunds),
      discounts: Number(patch.discounts ?? existing.discounts),
      lottery: patch.lottery !== undefined ? Number(patch.lottery) : existing.lottery ? Number(existing.lottery) : null,
      countedCash: Number(patch.countedCash ?? existing.countedCash),
      safeDropAmount: Number(patch.safeDropAmount ?? existingSafeDropAmount),
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
    // Account owners + per-store managers (scoped to their stores) can delete.
    const scope = resolveAdminScope(user);
    const existing = await this.repository.findByIdForOwner(id, scope.ownerId);
    if (!existing) throw new NotFoundException("Close not found.");
    assertScopeAllowsStore(scope, existing.storeId);

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
      if (!prefs.closeAlertsEnabled || !prefs.phone) return;
      // Path 1: Meta WhatsApp Cloud API (only if Meta creds are configured).
      if (this.whatsapp.isConfigured()) {
        const sent = await this.whatsapp.sendCloseCompletedTemplate({
          toPhone: prefs.phone,
          ownerName: store.owner.user.name,
          storeName: store.storeName
        });
        if (sent) return;
      }
      // Path 2: Twilio. A business-initiated WhatsApp message MUST use an
      // approved Content Template (ContentSid) — freeform text is rejected by
      // WhatsApp with error 63016. The daily_close_completed template takes
      // {{1}} = owner name, {{2}} = store name.
      //
      // Defaults to the approved daily_close_completed_v2 ContentSid so the
      // alert works even if TWILIO_TEMPLATE_CLOSE_COMPLETED isn't set in the
      // environment — mirrors how the Meta template names default (e.g.
      // WHATSAPP_TEMPLATE_MISSED || "missed_close"). A ContentSid is a template
      // identifier, not a secret; override via env if the template changes.
      const closeCompletedSid =
        process.env.TWILIO_TEMPLATE_CLOSE_COMPLETED || "HX16407e71f4d576b8f355376dee7d609c";
      if (closeCompletedSid) {
        await this.sms.sendWhatsAppTemplate(prefs.phone, closeCompletedSid, {
          "1": store.owner.user.name,
          "2": store.storeName
        });
        return;
      }
      // No template configured — last-resort freeform. Works for plain SMS;
      // WhatsApp will reject it, but that's preferable to silently sending
      // nothing in a dev/preview env where the template SID isn't set.
      await this.sms.send(
        prefs.phone,
        `Daily Close: ${store.storeName} closing was completed. Open Daily Close to view details.`
      );
    } catch (err: any) {
      this.logger.warn(`Close-completed WhatsApp alert skipped: ${err?.message || err}`);
    }
  }

  /**
   * Resolves whether `user` is allowed to close `storeId` and returns the
   * `(employeeId | null)` that should be written on the daily_close row.
   *
   * Post migration 006 the `employees` table is a store-assignment table:
   * one row per (user, store, role). For owners and employees alike,
   * authorisation is "does this user have an assignment for this store?"
   *   - Owners get an auto-created OWNER assignment row (created here
   *     on first close per store, or by the store-creation flow once
   *     that's wired up in StoresService).
   *   - Employees get an EMPLOYEE assignment created by the invite flow.
   *
   * Returns the assignment row's id so daily_close.employee_id can still
   * point at it for back-compat with older queries. New code should
   * prefer daily_close.submitted_by_user_id.
   *
   * No more wandering rows. No more relink hack. Each (user, store) is
   * a distinct row protected by the (user_id, store_id) composite unique.
   */
  private async assertCanCloseStore(user: RequestUser, storeId: string): Promise<string> {
    // Verify the user is allowed at this store at all.
    if (user.role === "STORE_OWNER" && user.ownerId) {
      const store = await this.prisma.store.findFirst({
        where: { id: storeId, ownerId: user.ownerId, deletedAt: null },
        select: { id: true }
      });
      if (!store) throw new ForbiddenException("This store is not yours.");
    } else if (user.role === "EMPLOYEE") {
      // Employee + manager assignments live in the same `employees` table;
      // either role authorises closing the store (a per-store manager has
      // full admin for their stores, which includes submitting closes).
      const assignment = await this.prisma.employee.findFirst({
        where: { userId: user.id, storeId, deletedAt: null, role: { in: ["EMPLOYEE", "MANAGER"] } },
        select: { id: true }
      });
      if (!assignment) {
        throw new ForbiddenException("You are not assigned to this store.");
      }
    } else if (user.role !== "SUPER_ADMIN") {
      throw new ForbiddenException("Not allowed to close this store.");
    }

    // Find-or-create the assignment row that will be referenced by
    // daily_close.employee_id. Owners get a role=OWNER row; employees
    // already had a role=EMPLOYEE row from the auth check above.
    const expectedRole = user.role === "STORE_OWNER" ? "OWNER" : "EMPLOYEE";
    const existing = await this.prisma.employee.findFirst({
      where: { userId: user.id, storeId, deletedAt: null }
    });
    if (existing) return existing.id;

    const created = await this.prisma.employee.create({
      data: { userId: user.id, storeId, role: expectedRole as any }
    });
    return created.id;
  }
}

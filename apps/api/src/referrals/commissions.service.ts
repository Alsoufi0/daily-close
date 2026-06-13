import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { CommissionStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AppSettingsService } from "./app-settings.service";
import { CreateAdjustmentDto } from "./dto/create-adjustment.dto";
import { currentPeriod } from "./partners.service";

export interface RecordInvoicePaymentInput {
  stripeInvoiceId: string;
  stripeCustomerId: string;
  /** Net amount actually paid, in the smallest currency unit (cents). */
  amountPaidCents: number;
  currency?: string;
  /** Invoice period start (unix seconds) — used for the period label. */
  periodStartUnix?: number | null;
}

export type RecordResult =
  | { created: true; commissionId: string }
  | { created: false; reason: "no_owner" | "not_referred" | "zero_amount" | "already_recorded" };

@Injectable()
export class CommissionsService {
  private readonly logger = new Logger(CommissionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: AppSettingsService
  ) {}

  /**
   * Mint a commission row from a REAL Stripe invoice payment. The single source
   * of commission truth — driven by money actually changing hands, never by
   * subscription status. Idempotent on the invoice id so webhook retries don't
   * double-pay. A $0 invoice (e.g. the trial's first invoice) creates nothing.
   */
  async recordInvoicePayment(input: RecordInvoicePaymentInput): Promise<RecordResult> {
    // Trial / $0 invoices never earn a commission.
    if (!input.amountPaidCents || input.amountPaidCents <= 0) {
      return { created: false, reason: "zero_amount" };
    }

    const owner = await this.prisma.owner.findUnique({
      where: { stripeCustomerId: input.stripeCustomerId },
      select: {
        id: true,
        referredByPartnerId: true,
        referredBy: { select: { commissionRate: true } }
      }
    });
    if (!owner) return { created: false, reason: "no_owner" };
    if (!owner.referredByPartnerId || !owner.referredBy) {
      return { created: false, reason: "not_referred" };
    }

    // Rate: per-partner override, else the platform default — snapshotted onto
    // the row so later rate changes never rewrite history.
    const rate =
      owner.referredBy.commissionRate !== null
        ? Number(owner.referredBy.commissionRate)
        : await this.settings.getDefaultRate();

    const commissionCents = Math.round(input.amountPaidCents * rate);
    const amount = new Prisma.Decimal((commissionCents / 100).toFixed(2));
    const period = this.periodLabel(input.periodStartUnix);

    try {
      const row = await this.prisma.commission.create({
        data: {
          partnerId: owner.referredByPartnerId,
          ownerId: owner.id,
          stripeInvoiceId: input.stripeInvoiceId,
          period,
          rate: new Prisma.Decimal(rate.toFixed(4)),
          amount,
          currency: (input.currency ?? "usd").toLowerCase(),
          sourceAmountCents: input.amountPaidCents,
          status: CommissionStatus.PENDING
        }
      });
      this.logger.log(
        `Commission ${row.id}: partner ${owner.referredByPartnerId} earned ${amount} on invoice ${input.stripeInvoiceId} (rate ${rate}).`
      );
      return { created: true, commissionId: row.id };
    } catch (err) {
      // Unique violation on stripe_invoice_id = this invoice was already
      // processed (webhook retry). Treat as success-no-op.
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        return { created: false, reason: "already_recorded" };
      }
      throw err;
    }
  }

  /**
   * Reverse the commission tied to an invoice (refund or chargeback). Flips the
   * matching row to REVERSED so it drops out of payout sums. No-op if there's no
   * row or it's already reversed. Returns whether a row was reversed.
   */
  async reverseByInvoice(stripeInvoiceId: string): Promise<{ reversed: boolean }> {
    if (!stripeInvoiceId) return { reversed: false };
    const existing = await this.prisma.commission.findUnique({
      where: { stripeInvoiceId },
      select: { id: true, status: true }
    });
    if (!existing || existing.status === CommissionStatus.REVERSED) {
      return { reversed: false };
    }
    await this.prisma.commission.update({
      where: { id: existing.id },
      data: { status: CommissionStatus.REVERSED }
    });
    this.logger.log(`Reversed commission ${existing.id} for invoice ${stripeInvoiceId}.`);
    return { reversed: true };
  }

  /** Payouts queue with partner info. Filterable by status / period / partner. */
  async listForPayouts(filter: {
    status?: CommissionStatus;
    period?: string;
    partnerId?: string;
  }) {
    const where: Prisma.CommissionWhereInput = {};
    if (filter.status) where.status = filter.status;
    if (filter.period) where.period = filter.period;
    if (filter.partnerId) where.partnerId = filter.partnerId;

    const rows = await this.prisma.commission.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { partner: { select: { id: true, name: true, refCode: true } } }
    });
    return rows.map((r) => ({
      ...r,
      rate: Number(r.rate),
      amount: Number(r.amount)
    }));
  }

  /** Totals by status for the current (or given) period — payouts page header. */
  async summary(period?: string) {
    const grouped = await this.prisma.commission.groupBy({
      by: ["status"],
      where: period ? { period } : undefined,
      _sum: { amount: true },
      _count: { _all: true }
    });
    const out: Record<string, { count: number; amount: number }> = {};
    for (const g of grouped) {
      out[g.status] = { count: g._count._all, amount: Number(g._sum.amount ?? 0) };
    }
    return out;
  }

  /**
   * Move a ledger row forward (APPROVED / PAID) or void it (REVERSED). Marking
   * PAID requires a payout reference so the ledger always records HOW it was
   * paid.
   */
  async updateStatus(
    id: string,
    status: CommissionStatus,
    payoutReference?: string
  ) {
    const row = await this.prisma.commission.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Commission not found.");
    if (status === CommissionStatus.PAID) {
      // Approval-before-payout is mandatory: a commission must be explicitly
      // approved by an admin before it can be marked paid. Nothing about money
      // moving is automated — "PAID" only records that the admin paid the
      // partner out-of-band — but this guard makes the approval step impossible
      // to skip.
      if (row.status !== CommissionStatus.APPROVED) {
        throw new BadRequestException("Approve this commission before marking it paid.");
      }
      if (!payoutReference) {
        throw new BadRequestException("A payout reference is required to mark a commission paid.");
      }
    }
    return this.prisma.commission.update({
      where: { id },
      data: {
        status,
        payoutReference:
          status === CommissionStatus.PAID ? payoutReference : row.payoutReference
      }
    });
  }

  /**
   * Manual ledger entry (bonus = positive amount, clawback = negative) so a
   * partner's payout can be reconciled by hand. Not tied to a Stripe invoice.
   */
  async createAdjustment(dto: CreateAdjustmentDto) {
    const partner = await this.prisma.partner.findUnique({
      where: { id: dto.partnerId },
      select: { id: true }
    });
    if (!partner) throw new NotFoundException("Partner not found.");

    // Adjustments are partner-level — no owner anchor (owner_id stays null).
    return this.prisma.commission.create({
      data: {
        partnerId: dto.partnerId,
        period: dto.period || currentPeriod(),
        rate: new Prisma.Decimal(0),
        amount: new Prisma.Decimal(dto.amount.toFixed(2)),
        kind: "ADJUSTMENT",
        status: CommissionStatus.PENDING,
        note: dto.note
      }
    });
  }

  private periodLabel(periodStartUnix?: number | null): string {
    if (periodStartUnix && periodStartUnix > 0) {
      return currentPeriod(new Date(periodStartUnix * 1000));
    }
    return currentPeriod();
  }
}

import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreatePartnerDto } from "./dto/create-partner.dto";
import { UpdatePartnerDto } from "./dto/update-partner.dto";
import { generateRefCode } from "./ref-code";
import { ScanAlertService } from "./scan-alert.service";

/** Current billing-period label in UTC, e.g. "2026-06". */
export function currentPeriod(now: Date = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

@Injectable()
export class PartnersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scanAlerts: ScanAlertService
  ) {}

  /** All partners, newest first, each with rollup counts for the admin list. */
  async list() {
    const partners = await this.prisma.partner.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { referredOwners: true, commissions: true } } }
    });
    return partners.map((p) => ({
      ...p,
      commissionRate: p.commissionRate === null ? null : Number(p.commissionRate),
      referredOwnerCount: p._count.referredOwners
    }));
  }

  /**
   * Create a partner with a freshly generated, unique referral code. Retries a
   * handful of times on the (astronomically rare) code collision before giving
   * up. The code is generated ONCE here and never regenerated afterwards.
   */
  async create(dto: CreatePartnerDto) {
    const data: Prisma.PartnerCreateInput = {
      name: dto.name,
      contact: dto.contact ?? null,
      payoutDetails: dto.payoutDetails ?? null,
      commissionRate:
        dto.commissionRate === undefined ? null : new Prisma.Decimal(dto.commissionRate),
      refCode: generateRefCode()
    };

    for (let attempt = 0; attempt < 6; attempt++) {
      try {
        return await this.prisma.partner.create({ data });
      } catch (err) {
        if (this.isRefCodeCollision(err)) {
          data.refCode = generateRefCode();
          continue;
        }
        throw err;
      }
    }
    throw new BadRequestException("Could not allocate a unique referral code. Please retry.");
  }

  async get(id: string) {
    const partner = await this.prisma.partner.findUnique({ where: { id } });
    if (!partner) throw new NotFoundException("Partner not found.");
    return partner;
  }

  async update(id: string, dto: UpdatePartnerDto) {
    await this.get(id); // 404 if missing
    const data: Prisma.PartnerUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.contact !== undefined) data.contact = dto.contact;
    if (dto.payoutDetails !== undefined) data.payoutDetails = dto.payoutDetails;
    if (dto.active !== undefined) data.active = dto.active;
    // null clears the override (fall back to platform default); a number sets it.
    if (dto.commissionRate !== undefined) {
      data.commissionRate =
        dto.commissionRate === null ? null : new Prisma.Decimal(dto.commissionRate);
    }
    return this.prisma.partner.update({ where: { id }, data });
  }

  /**
   * Hard-delete a partner. Guard: refuse when any commission has been PAID, so
   * real payout history can't be erased (deactivate those instead). Otherwise
   * the delete cascades away pending/approved/reversed commission rows and nulls
   * the attribution on any referred owners (FK on delete set null).
   */
  async delete(id: string) {
    await this.get(id); // 404 if missing
    const paid = await this.prisma.commission.count({
      where: { partnerId: id, status: "PAID" }
    });
    if (paid > 0) {
      throw new BadRequestException(
        "This partner has paid commissions on record — deactivate it instead so the payout history is preserved."
      );
    }
    await this.prisma.partner.delete({ where: { id } });
    return { id, deleted: true };
  }

  /**
   * Resolve an active partner by referral code, returning its id, or null. Used
   * by both the public scan endpoint and signup stamping. Inactive partners do
   * not attribute new signups.
   */
  async activePartnerIdByRefCode(refCode: string): Promise<string | null> {
    if (!refCode) return null;
    const partner = await this.prisma.partner.findUnique({
      where: { refCode },
      select: { id: true, active: true }
    });
    if (!partner || !partner.active) return null;
    return partner.id;
  }

  /**
   * Record a QR/link visit (top of the funnel) and report whether the code maps
   * to an active partner. Best-effort: never throws on an unknown code, so the
   * public web route can decide to carry the ref or not without erroring.
   */
  async recordScan(refCode: string): Promise<{ valid: boolean }> {
    const partnerId = await this.activePartnerIdByRefCode(refCode);
    if (!partnerId) return { valid: false };
    const updated = await this.prisma.partner.update({
      where: { id: partnerId },
      data: { scanCount: { increment: 1 } },
      select: { name: true, refCode: true, scanCount: true }
    });
    // Fire-and-forget the scan alert so it never delays the redirect. The
    // service swallows its own errors.
    void this.scanAlerts.notifyScan({
      partnerName: updated.name,
      refCode: updated.refCode,
      scanCount: updated.scanCount
    });
    return { valid: true };
  }

  /**
   * Roster of the actual accounts a partner referred — answers "who really
   * subscribed and stayed", not just who scanned. Each row carries the live
   * subscription status plus how many real payments they've made (retention)
   * and the commission earned from them.
   */
  async referredAccounts(partnerId: string) {
    await this.get(partnerId); // 404 if missing
    const owners = await this.prisma.owner.findMany({
      where: { referredByPartnerId: partnerId },
      select: {
        id: true,
        subscriptionStatus: true,
        trialEndsAt: true,
        user: { select: { name: true, email: true, createdAt: true } },
        stores: { where: { deletedAt: null }, select: { storeName: true } }
      }
    });

    // Per-account real-payment rollup (COMMISSION rows = actual paid invoices).
    const grouped = await this.prisma.commission.groupBy({
      by: ["ownerId"],
      where: { partnerId, kind: "COMMISSION", ownerId: { not: null } },
      _count: { _all: true },
      _sum: { amount: true },
      _max: { period: true }
    });
    const byOwner = new Map(grouped.map((g) => [g.ownerId, g]));

    const now = Date.now();
    return owners
      .map((o) => {
        const g = byOwner.get(o.id);
        const inTrial =
          o.subscriptionStatus === "TRIALING" && (!o.trialEndsAt || o.trialEndsAt.getTime() > now);
        return {
          ownerId: o.id,
          name: o.user?.name ?? "—",
          email: o.user?.email ?? null,
          joinedAt: o.user?.createdAt ?? null,
          stores: o.stores.map((s) => s.storeName),
          status: o.subscriptionStatus,
          inTrial,
          payments: g?._count._all ?? 0,
          totalCommission: Number(g?._sum.amount ?? 0),
          lastPaidPeriod: g?._max.period ?? null
        };
      })
      .sort((a, b) => (b.joinedAt?.getTime() ?? 0) - (a.joinedAt?.getTime() ?? 0));
  }

  /**
   * Per-partner funnel for the admin detail view:
   *   scanned   → raw QR/link visits
   *   inTrial   → referred owners currently in an unexpired trial
   *   active    → referred owners on a live paid subscription
   *   thisMonthPayout → commissions earned this period (excludes reversed)
   */
  async funnel(id: string) {
    const partner = await this.get(id);
    const owners = await this.prisma.owner.findMany({
      where: { referredByPartnerId: id },
      select: { subscriptionStatus: true, trialEndsAt: true }
    });
    const now = Date.now();
    let inTrial = 0;
    let active = 0;
    for (const o of owners) {
      if (o.subscriptionStatus === "ACTIVE") active++;
      else if (
        o.subscriptionStatus === "TRIALING" &&
        (!o.trialEndsAt || o.trialEndsAt.getTime() > now)
      ) {
        inTrial++;
      }
    }

    const period = currentPeriod();
    const monthRows = await this.prisma.commission.aggregate({
      where: { partnerId: id, period, status: { not: "REVERSED" } },
      _sum: { amount: true }
    });
    const lifetimeRows = await this.prisma.commission.aggregate({
      where: { partnerId: id, status: { in: ["APPROVED", "PAID"] } },
      _sum: { amount: true }
    });

    return {
      partner: {
        ...partner,
        commissionRate: partner.commissionRate === null ? null : Number(partner.commissionRate)
      },
      funnel: {
        scanned: partner.scanCount,
        signedUp: owners.length,
        inTrial,
        active,
        thisMonthPayout: Number(monthRows._sum.amount ?? 0),
        lifetimeApprovedOrPaid: Number(lifetimeRows._sum.amount ?? 0)
      }
    };
  }

  private isRefCodeCollision(err: unknown): boolean {
    return (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002" &&
      // target may be an array of fields or a string depending on driver
      String((err.meta as { target?: unknown })?.target ?? "").includes("ref_code")
    );
  }
}

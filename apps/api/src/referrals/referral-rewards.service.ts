import { Injectable, Logger } from "@nestjs/common";
import { Prisma, ReferralRewardStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ScanAlertService } from "./scan-alert.service";
import { generateRefCode } from "./ref-code";

export interface RecordRewardInput {
  /** Stripe customer of the REFEREE (the new owner, "B") whose invoice was paid. */
  referredStripeCustomerId: string;
  /** B's first paid invoice id (idempotency + first-payment marker). */
  stripeInvoiceId: string;
  /** Net amount B actually paid on this invoice (cents). Gates out $0 trials. */
  amountPaidCents: number;
  /** Stores B paid for on this invoice (the subscription quantity). */
  storeCount: number;
  /** Per-store list price in cents (the snapshot the reward is computed from). */
  unitAmountCents: number;
  currency?: string;
}

export type RecordRewardResult =
  | { created: true; rewardId: string; amountCents: number; status: ReferralRewardStatus }
  | {
      created: false;
      reason:
        | "no_owner"
        | "not_referred"
        | "already_rewarded"
        | "zero_amount"
        | "self_referral";
    };

// A reward at or above this triggers an ops alert (recommendation #3: no hard
// cap, just a heads-up on large payouts). Override with REFERRAL_ALERT_CENTS.
const DEFAULT_ALERT_CENTS = 20_000; // $200

@Injectable()
export class ReferralRewardsService {
  private readonly logger = new Logger(ReferralRewardsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly alerts: ScanAlertService
  ) {}

  /**
   * Mint an owner→owner referral credit from the referee's FIRST real payment.
   * The credit mirrors that payment: one free store-month per store paid for
   * (storeCount × unitAmountCents). Fires once per referral — the first paid
   * invoice — and is idempotent on the invoice id. $0 (trial) invoices and
   * unreferred / partner-referred owners create nothing.
   *
   * If the referrer already has a Stripe customer, the credit is posted to their
   * balance immediately (APPLIED); otherwise it waits as PENDING until they do
   * (see flushPendingForReferrer).
   */
  async recordFirstPaymentReward(input: RecordRewardInput): Promise<RecordRewardResult> {
    // Real money only: a $0 trial invoice never earns a reward, even though its
    // line still carries the per-store list price. This is what makes "first
    // PAYMENT" mean the first real charge, not trial start.
    if (!input.amountPaidCents || input.amountPaidCents <= 0) {
      return { created: false, reason: "zero_amount" };
    }
    const storeCount = Math.max(0, Math.trunc(input.storeCount || 0));
    const unitAmountCents = Math.max(0, Math.trunc(input.unitAmountCents || 0));
    const amountCents = storeCount * unitAmountCents;
    if (amountCents <= 0) return { created: false, reason: "zero_amount" };

    const referee = await this.prisma.owner.findUnique({
      where: { stripeCustomerId: input.referredStripeCustomerId },
      select: {
        id: true,
        referredByOwnerId: true,
        referredByOwner: { select: { id: true, stripeCustomerId: true } }
      }
    });
    if (!referee) return { created: false, reason: "no_owner" };
    if (!referee.referredByOwnerId || !referee.referredByOwner) {
      return { created: false, reason: "not_referred" };
    }
    if (referee.referredByOwner.id === referee.id) {
      return { created: false, reason: "self_referral" };
    }

    // First-payment-only: if this referee already earned their referrer a
    // reward, never mint a second one (later invoices don't re-reward).
    const prior = await this.prisma.referralReward.findFirst({
      where: { referredOwnerId: referee.id },
      select: { id: true }
    });
    if (prior) return { created: false, reason: "already_rewarded" };

    const currency = (input.currency ?? "usd").toLowerCase();
    let reward;
    try {
      reward = await this.prisma.referralReward.create({
        data: {
          referrerOwnerId: referee.referredByOwner.id,
          referredOwnerId: referee.id,
          stripeInvoiceId: input.stripeInvoiceId,
          storeCount,
          unitAmountCents,
          amountCents,
          currency,
          status: ReferralRewardStatus.PENDING
        }
      });
    } catch (err) {
      // Unique violation on the invoice = webhook retry of the same first
      // invoice. Treat as a success-no-op.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        return { created: false, reason: "already_rewarded" };
      }
      throw err;
    }

    // Apply the credit now if we can; otherwise it stays PENDING for the flush.
    let status: ReferralRewardStatus = ReferralRewardStatus.PENDING;
    const referrerCustomerId = referee.referredByOwner.stripeCustomerId;
    if (referrerCustomerId) {
      const txnId = await this.creditCustomerBalance(
        referrerCustomerId,
        -amountCents,
        currency,
        `Daily Close referral credit — ${storeCount} store-month(s)`
      );
      if (txnId) {
        await this.prisma.referralReward.update({
          where: { id: reward.id },
          data: { status: ReferralRewardStatus.APPLIED, stripeBalanceTxnId: txnId }
        });
        status = ReferralRewardStatus.APPLIED;
      }
    }

    this.logger.log(
      `Referral reward ${reward.id}: owner ${referee.referredByOwner.id} earned ${this.fmt(
        amountCents
      )} (${storeCount} store-month(s)) from referee ${referee.id} on invoice ${
        input.stripeInvoiceId
      } [${status}].`
    );
    this.maybeAlertLargeReward({ amountCents, storeCount, currency, status });

    return { created: true, rewardId: reward.id, amountCents, status };
  }

  /**
   * Post any PENDING credits a referrer earned to their Stripe balance, once they
   * have a Stripe customer (e.g. right after they check out). Best-effort and
   * idempotent: rewards already APPLIED/REVERSED are skipped.
   */
  async flushPendingForReferrer(ownerId: string): Promise<{ applied: number }> {
    const owner = await this.prisma.owner.findUnique({
      where: { id: ownerId },
      select: { stripeCustomerId: true }
    });
    if (!owner?.stripeCustomerId) return { applied: 0 };

    const pending = await this.prisma.referralReward.findMany({
      where: { referrerOwnerId: ownerId, status: ReferralRewardStatus.PENDING }
    });
    let applied = 0;
    for (const r of pending) {
      const txnId = await this.creditCustomerBalance(
        owner.stripeCustomerId,
        -r.amountCents,
        r.currency,
        `Daily Close referral credit — ${r.storeCount} store-month(s)`
      );
      if (!txnId) continue;
      await this.prisma.referralReward.update({
        where: { id: r.id },
        data: { status: ReferralRewardStatus.APPLIED, stripeBalanceTxnId: txnId }
      });
      applied++;
    }
    if (applied > 0) {
      this.logger.log(`Flushed ${applied} pending referral credit(s) for owner ${ownerId}.`);
    }
    return { applied };
  }

  /**
   * Reverse the referral credit tied to a refunded/disputed first invoice. If it
   * was already APPLIED, post the opposite (debit) entry to the referrer's Stripe
   * balance so the credit is undone. No-op if there's no row or it's already
   * reversed.
   */
  async reverseByInvoice(stripeInvoiceId: string): Promise<{ reversed: boolean }> {
    if (!stripeInvoiceId) return { reversed: false };
    const reward = await this.prisma.referralReward.findUnique({
      where: { stripeInvoiceId },
      select: {
        id: true,
        status: true,
        amountCents: true,
        currency: true,
        referrerOwner: { select: { stripeCustomerId: true } }
      }
    });
    if (!reward || reward.status === ReferralRewardStatus.REVERSED) {
      return { reversed: false };
    }
    if (reward.status === ReferralRewardStatus.APPLIED && reward.referrerOwner?.stripeCustomerId) {
      // Positive amount = debit = removes the credit we previously gave.
      await this.creditCustomerBalance(
        reward.referrerOwner.stripeCustomerId,
        reward.amountCents,
        reward.currency,
        "Daily Close referral credit reversed (referee payment refunded)"
      );
    }
    await this.prisma.referralReward.update({
      where: { id: reward.id },
      data: { status: ReferralRewardStatus.REVERSED }
    });
    this.logger.log(`Reversed referral reward ${reward.id} for invoice ${stripeInvoiceId}.`);
    return { reversed: true };
  }

  /**
   * The owner-facing summary for the billing "Refer a friend" card: their code,
   * how many friends joined, and how much credit they've earned. Lazily mints
   * the code and flushes any pending credits on the way (so opening billing
   * applies what's owed).
   */
  async summaryForOwner(ownerId: string) {
    const code = await this.ensureReferralCode(ownerId);
    await this.flushPendingForReferrer(ownerId).catch(() => undefined);

    const rows = await this.prisma.referralReward.findMany({
      where: { referrerOwnerId: ownerId, status: { not: ReferralRewardStatus.REVERSED } },
      select: { amountCents: true, status: true }
    });
    let earnedCents = 0;
    let appliedCents = 0;
    let pendingCents = 0;
    for (const r of rows) {
      earnedCents += r.amountCents;
      if (r.status === ReferralRewardStatus.APPLIED) appliedCents += r.amountCents;
      else pendingCents += r.amountCents;
    }
    return {
      code,
      referralCount: rows.length,
      earnedCents,
      appliedCents,
      pendingCents
    };
  }

  /**
   * Return the owner's referral code, generating a unique one on first use. The
   * code shares the partners' unambiguous alphabet and is checked against BOTH
   * tables so an owner code can never collide with a partner code.
   */
  async ensureReferralCode(ownerId: string): Promise<string> {
    const existing = await this.prisma.owner.findUnique({
      where: { id: ownerId },
      select: { referralCode: true }
    });
    if (existing?.referralCode) return existing.referralCode;

    for (let attempt = 0; attempt < 8; attempt++) {
      const candidate = generateRefCode();
      if (await this.codeTaken(candidate)) continue;
      try {
        const updated = await this.prisma.owner.update({
          where: { id: ownerId },
          data: { referralCode: candidate },
          select: { referralCode: true }
        });
        return updated.referralCode!;
      } catch (err) {
        // Lost a race on the unique index — try a fresh code.
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") continue;
        throw err;
      }
    }
    throw new Error("Could not allocate a unique referral code.");
  }

  /** Resolve an owner's referral code to their owner id (active accounts only). */
  async ownerIdByReferralCode(code: string): Promise<string | null> {
    const trimmed = code?.trim();
    if (!trimmed) return null;
    const owner = await this.prisma.owner.findUnique({
      where: { referralCode: trimmed },
      select: { id: true }
    });
    return owner?.id ?? null;
  }

  private async codeTaken(code: string): Promise<boolean> {
    const [asOwner, asPartner] = await Promise.all([
      this.prisma.owner.findUnique({ where: { referralCode: code }, select: { id: true } }),
      this.prisma.partner.findUnique({ where: { refCode: code }, select: { id: true } })
    ]);
    return Boolean(asOwner || asPartner);
  }

  /**
   * Post a Stripe customer-balance transaction. A NEGATIVE amount is a credit
   * (reduces what the customer owes and rolls over to future invoices); a
   * POSITIVE amount is a debit (used to reverse a credit). Returns the
   * transaction id, or null if Stripe is unconfigured or the call fails — callers
   * leave the row PENDING and retry via the flush path rather than throwing into
   * a webhook.
   */
  private async creditCustomerBalance(
    customerId: string,
    amountCents: number,
    currency: string,
    description: string
  ): Promise<string | null> {
    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret) {
      this.logger.warn(
        `[referral-credit:DRY-RUN] ${amountCents} ${currency} on ${customerId} (STRIPE_SECRET_KEY unset).`
      );
      return null;
    }
    try {
      const params = new URLSearchParams();
      params.set("amount", String(amountCents));
      params.set("currency", currency);
      params.set("description", description);
      const res = await fetch(
        `https://api.stripe.com/v1/customers/${encodeURIComponent(customerId)}/balance_transactions`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${secret}`,
            "Content-Type": "application/x-www-form-urlencoded"
          },
          body: params.toString()
        }
      );
      if (!res.ok) {
        throw new Error(`Stripe ${res.status}: ${(await res.text()).slice(0, 160)}`);
      }
      const body = (await res.json()) as { id?: string };
      return body.id ?? null;
    } catch (err) {
      this.logger.warn(
        `Stripe balance transaction failed for ${customerId}: ${(err as Error)?.message || err}`
      );
      return null;
    }
  }

  private maybeAlertLargeReward(input: {
    amountCents: number;
    storeCount: number;
    currency: string;
    status: ReferralRewardStatus;
  }) {
    const threshold = Number(process.env.REFERRAL_ALERT_CENTS) || DEFAULT_ALERT_CENTS;
    if (input.amountCents < threshold) return;
    void this.alerts.notifyLargeReward({
      amountText: this.fmt(input.amountCents),
      storeCount: input.storeCount,
      status: input.status
    });
  }

  private fmt(cents: number): string {
    return `$${(cents / 100).toFixed(2)}`;
  }
}

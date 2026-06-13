import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  Logger,
  Post,
  Req,
  UseGuards
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { CurrentUser } from "../auth/current-user.decorator";
import { RequestUser } from "../auth/request-user";
import { SupabaseAuthGuard } from "../auth/supabase-auth.guard";
import { CommissionsService } from "../referrals/commissions.service";
import { StripeSignatureError, verifyStripeSignature } from "./stripe-signature";
import { SubscriptionsService } from "./subscriptions.service";

@ApiTags("Subscriptions")
@Controller("subscriptions")
export class SubscriptionsController {
  private readonly logger = new Logger(SubscriptionsController.name);

  constructor(
    private readonly subscriptions: SubscriptionsService,
    private readonly commissions: CommissionsService
  ) {}

  @Get("me")
  @ApiBearerAuth()
  @UseGuards(SupabaseAuthGuard)
  async me(@CurrentUser() user: RequestUser) {
    if (user.role !== "STORE_OWNER" || !user.ownerId) {
      throw new ForbiddenException("Only owners have a subscription.");
    }
    return this.subscriptions.getForOwner(user.ownerId);
  }

  // Verification: the result of the boot-time heal (which paid-but-unsynced
  // owners were reconciled from Stripe). Also re-runs the heal on demand so a
  // freshly-affected account can be synced without waiting for a restart.
  @Get("reconcile-status")
  @ApiBearerAuth()
  @UseGuards(SupabaseAuthGuard)
  async reconcileStatus(@CurrentUser() user: RequestUser) {
    if (user.role !== "STORE_OWNER" || !user.ownerId) {
      throw new ForbiddenException("Only owners can view reconcile status.");
    }
    const live = await this.subscriptions.reconcileAllInactive();
    return { boot: this.subscriptions.bootReconcile, live };
  }

  @Post("create-checkout")
  @ApiBearerAuth()
  @UseGuards(SupabaseAuthGuard)
  async createCheckout(@CurrentUser() user: RequestUser): Promise<{ url: string }> {
    if (user.role !== "STORE_OWNER" || !user.ownerId) {
      throw new ForbiddenException("Only owners can start a subscription.");
    }
    try {
      const url = await this.subscriptions.createCheckoutForOwner(user.ownerId, user.email);
      return { url };
    } catch (err: any) {
      throw new BadRequestException(err?.message || "Could not start checkout.");
    }
  }

  // Stripe Billing Portal: update card, view invoices, or cancel. Stripe hosts
  // the flow; we mint a per-customer session and the client redirects to it.
  @Post("create-portal")
  @ApiBearerAuth()
  @UseGuards(SupabaseAuthGuard)
  async createPortal(@CurrentUser() user: RequestUser): Promise<{ url: string }> {
    if (user.role !== "STORE_OWNER" || !user.ownerId) {
      throw new ForbiddenException("Only owners can manage billing.");
    }
    try {
      const url = await this.subscriptions.createPortalSession(user.ownerId);
      return { url };
    } catch (err: any) {
      throw new BadRequestException(err?.message || "Could not open billing portal.");
    }
  }

  // Stripe webhook. The signature is verified against the raw request body
  // (captured in main.ts) using STRIPE_WEBHOOK_SECRET. A forged POST here can
  // otherwise flip an owner to ACTIVE without paying, so we FAIL CLOSED in
  // production when the secret is missing, and only accept-but-warn in dev.
  @Post("webhook")
  @HttpCode(200)
  async webhook(
    @Req() req: Request,
    @Body() payload: any,
    @Headers("stripe-signature") signature: string | undefined
  ) {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;

    if (secret) {
      try {
        verifyStripeSignature({
          rawBody: (req as Request & { rawBody?: Buffer }).rawBody,
          signatureHeader: signature,
          secret
        });
      } catch (err) {
        const reason = err instanceof StripeSignatureError ? err.message : "verification error";
        this.logger.warn(`Rejected Stripe webhook: ${reason}`);
        throw new BadRequestException("Invalid Stripe signature.");
      }
    } else if (process.env.NODE_ENV === "production") {
      // No secret in prod = we cannot verify = we must not trust the caller.
      this.logger.error(
        "Rejected Stripe webhook: STRIPE_WEBHOOK_SECRET is not set in production."
      );
      throw new BadRequestException("Webhook signature verification is not configured.");
    } else {
      this.logger.warn(
        `Accepting Stripe webhook WITHOUT signature verification (NODE_ENV=${
          process.env.NODE_ENV || "development"
        }). Set STRIPE_WEBHOOK_SECRET to enable.`
      );
    }

    const type: string | undefined = payload?.type;
    const object = payload?.data?.object;
    if (!type || !object) {
      throw new BadRequestException("Unsupported webhook payload.");
    }

    // ── Commission events (driven by REAL money, not subscription status) ──
    // A successful invoice payment earns the referring partner a commission; a
    // refund or chargeback reverses the matching row. Handled and acknowledged
    // independently of the subscription-status sync below.
    if (type === "invoice.payment_succeeded" || type === "invoice.paid") {
      await this.handleInvoicePaid(object);
      return { received: true };
    }
    if (type === "charge.refunded" || type === "charge.dispute.created") {
      await this.handleReversal(type, object);
      return { received: true };
    }

    // ── Subscription / checkout status sync (existing behaviour) ──
    const checkoutCompleted = type === "checkout.session.completed";
    const customerId: string | undefined = object?.customer;
    const subscriptionId: string | undefined = checkoutCompleted ? object?.subscription : object?.id;
    const ownerId: string | undefined = checkoutCompleted
      ? object?.client_reference_id || object?.metadata?.ownerId
      : object?.metadata?.ownerId;
    const status: string | undefined = checkoutCompleted
      ? "active"
      : object?.status;

    // Not a status-bearing event we sync (and not a commission event handled
    // above) — acknowledge so Stripe stops retrying rather than 400-looping.
    if (!customerId || !status) {
      return { received: true };
    }

    const mapped =
      status === "active"
        ? "ACTIVE"
        : status === "trialing"
          ? "TRIALING"
          : status === "past_due"
            ? "PAST_DUE"
            : "CANCELED";

    try {
      await this.subscriptions.syncFromStripe({
        ownerId,
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
        status: mapped
      });
    } catch {
      // Owner not yet linked - swallow.
    }
    return { received: true };
  }

  // Mint a commission from a paid invoice. Idempotent + best-effort: a failure
  // here must never 500 the webhook (Stripe would retry forever), so we log and
  // move on. CommissionsService skips $0 (trial) invoices and unreferred owners.
  private async handleInvoicePaid(invoice: any): Promise<void> {
    const stripeInvoiceId: string | undefined = invoice?.id;
    const stripeCustomerId: string | undefined = invoice?.customer;
    if (!stripeInvoiceId || !stripeCustomerId) return;
    const amountPaidCents = Number(invoice?.amount_paid ?? 0);
    const periodStartUnix: number | null =
      invoice?.period_start ?? invoice?.lines?.data?.[0]?.period?.start ?? null;
    try {
      const result = await this.commissions.recordInvoicePayment({
        stripeInvoiceId,
        stripeCustomerId,
        amountPaidCents,
        currency: invoice?.currency,
        periodStartUnix
      });
      if (!result.created) {
        this.logger.log(`Invoice ${stripeInvoiceId}: no commission (${result.reason}).`);
      }
    } catch (err) {
      this.logger.warn(
        `Commission record failed for invoice ${stripeInvoiceId}: ${(err as Error)?.message || err}`
      );
    }
  }

  // Reverse the commission tied to a refunded/disputed charge. A refund event
  // carries the invoice id directly; a dispute carries only the charge, so we
  // resolve the invoice from Stripe when needed.
  private async handleReversal(type: string, object: any): Promise<void> {
    let invoiceId: string | undefined =
      typeof object?.invoice === "string" ? object.invoice : undefined;
    if (!invoiceId && type === "charge.dispute.created") {
      invoiceId = await this.fetchChargeInvoiceId(object?.charge);
    }
    if (!invoiceId) {
      this.logger.log(`Reversal event ${type} had no resolvable invoice; ignoring.`);
      return;
    }
    try {
      const { reversed } = await this.commissions.reverseByInvoice(invoiceId);
      this.logger.log(
        `Reversal ${type} for invoice ${invoiceId}: ${reversed ? "reversed" : "no matching commission"}.`
      );
    } catch (err) {
      this.logger.warn(
        `Reversal failed for invoice ${invoiceId}: ${(err as Error)?.message || err}`
      );
    }
  }

  private async fetchChargeInvoiceId(chargeId?: string): Promise<string | undefined> {
    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret || !chargeId) return undefined;
    try {
      const res = await fetch(`https://api.stripe.com/v1/charges/${chargeId}`, {
        headers: { Authorization: `Bearer ${secret}` }
      });
      if (!res.ok) return undefined;
      const data = (await res.json()) as { invoice?: string | null };
      return typeof data.invoice === "string" ? data.invoice : undefined;
    } catch {
      return undefined;
    }
  }
}

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
import { StripeSignatureError, verifyStripeSignature } from "./stripe-signature";
import { SubscriptionsService } from "./subscriptions.service";

@ApiTags("Subscriptions")
@Controller("subscriptions")
export class SubscriptionsController {
  private readonly logger = new Logger(SubscriptionsController.name);

  constructor(private readonly subscriptions: SubscriptionsService) {}

  @Get("me")
  @ApiBearerAuth()
  @UseGuards(SupabaseAuthGuard)
  async me(@CurrentUser() user: RequestUser) {
    if (user.role !== "STORE_OWNER" || !user.ownerId) {
      throw new ForbiddenException("Only owners have a subscription.");
    }
    return this.subscriptions.getForOwner(user.ownerId);
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
    const checkoutCompleted = type === "checkout.session.completed";
    const customerId: string | undefined = object?.customer;
    const subscriptionId: string | undefined = checkoutCompleted ? object?.subscription : object?.id;
    const ownerId: string | undefined = checkoutCompleted
      ? object?.client_reference_id || object?.metadata?.ownerId
      : object?.metadata?.ownerId;
    const status: string | undefined = checkoutCompleted
      ? "active"
      : object?.status;

    if (!type || !customerId || !status) {
      throw new BadRequestException("Unsupported webhook payload.");
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
}

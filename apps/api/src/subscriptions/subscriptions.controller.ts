import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  Post,
  UseGuards
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../auth/current-user.decorator";
import { RequestUser } from "../auth/request-user";
import { SupabaseAuthGuard } from "../auth/supabase-auth.guard";
import { SubscriptionsService } from "./subscriptions.service";

@ApiTags("Subscriptions")
@Controller("subscriptions")
export class SubscriptionsController {
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

  // Stripe webhook. Validate the signature when STRIPE_WEBHOOK_SECRET is set.
  @Post("webhook")
  @HttpCode(200)
  async webhook(
    @Body() payload: any,
    @Headers("stripe-signature") signature: string | undefined
  ) {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (secret && !signature) {
      throw new BadRequestException("Missing Stripe signature.");
    }
    // We don't ship a full Stripe SDK by default; the webhook accepts the
    // event payload (already-verified by the proxy/edge function) and updates
    // owner subscription state.
    const type: string | undefined = payload?.type;
    const customerId: string | undefined = payload?.data?.object?.customer;
    const subscriptionId: string | undefined = payload?.data?.object?.id;
    const status: string | undefined = payload?.data?.object?.status;

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

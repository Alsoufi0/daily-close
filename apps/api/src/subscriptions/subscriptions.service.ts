import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

export type SubscriptionStatus = "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELED";

export interface SubscriptionView {
  status: SubscriptionStatus;
  plan: string;
  trialEndsAt: string | null;
  daysLeftInTrial: number | null;
  active: boolean;
  stripeCustomerId: string | null;
  activeStoreCount: number;
  billedStoreQuantity: number;
  unitAmountCents: number;
  priceId: string | null;
  checkoutUrl: string | null;
  portalUrl: string | null;
}

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(private readonly prisma: PrismaService) {}

  static isActive(status: string, trialEndsAt: Date | null): boolean {
    if (status === "ACTIVE") return true;
    if (status === "TRIALING") {
      if (!trialEndsAt) return true; // grace if not yet set
      return trialEndsAt.getTime() > Date.now();
    }
    return false;
  }

  static daysLeft(trialEndsAt: Date | null): number | null {
    if (!trialEndsAt) return null;
    const ms = trialEndsAt.getTime() - Date.now();
    return Math.max(0, Math.ceil(ms / 86_400_000));
  }

  async getForOwner(ownerId: string): Promise<SubscriptionView> {
    const owner = await this.prisma.owner.findUnique({ where: { id: ownerId } });
    if (!owner) throw new NotFoundException("Owner not found.");
    const status = (owner.subscriptionStatus || "TRIALING") as SubscriptionStatus;
    const activeStoreCount = await this.activeStoreCount(ownerId);
    const billedStoreQuantity = this.billableQuantity(activeStoreCount);
    return {
      status,
      plan: owner.subscriptionPlan,
      trialEndsAt: owner.trialEndsAt ? owner.trialEndsAt.toISOString() : null,
      daysLeftInTrial: SubscriptionsService.daysLeft(owner.trialEndsAt),
      active: SubscriptionsService.isActive(status, owner.trialEndsAt),
      stripeCustomerId: owner.stripeCustomerId,
      activeStoreCount,
      billedStoreQuantity,
      unitAmountCents: Number(process.env.STRIPE_UNIT_AMOUNT_CENTS || 4999),
      priceId: process.env.STRIPE_PRICE_ID || null,
      checkoutUrl: process.env.STRIPE_CHECKOUT_URL || null,
      portalUrl: process.env.STRIPE_PORTAL_URL || null
    };
  }

  async ensureActiveForOwner(ownerId: string): Promise<void> {
    const owner = await this.prisma.owner.findUnique({ where: { id: ownerId } });
    if (!owner) throw new NotFoundException("Owner not found.");
    if (!SubscriptionsService.isActive(owner.subscriptionStatus, owner.trialEndsAt)) {
      const err: any = new Error("Subscription required.");
      err.statusCode = 402;
      throw err;
    }
  }

  async syncFromStripe(input: {
    ownerId?: string | null;
    stripeCustomerId: string;
    stripeSubscriptionId?: string | null;
    status: string;
  }) {
    if (input.ownerId) {
      return this.prisma.owner.update({
        where: { id: input.ownerId },
        data: {
          subscriptionStatus: input.status,
          stripeCustomerId: input.stripeCustomerId,
          stripeSubscriptionId: input.stripeSubscriptionId ?? undefined
        }
      });
    }
    return this.prisma.owner.update({
      where: { stripeCustomerId: input.stripeCustomerId },
      data: {
        subscriptionStatus: input.status,
        stripeSubscriptionId: input.stripeSubscriptionId ?? undefined
      }
    });
  }

  /**
   * Creates a Stripe Checkout session for the owner and returns its URL.
   * Self-serve: owner clicks "Start paid plan", Stripe handles card collection,
   * webhook flips them to ACTIVE.
   *
   * Required env: STRIPE_SECRET_KEY, STRIPE_PRICE_ID.
   * Optional env: STRIPE_SUCCESS_URL, STRIPE_CANCEL_URL (default to site root).
   */
  async createCheckoutForOwner(ownerId: string, ownerEmail: string): Promise<string> {
    const secret = process.env.STRIPE_SECRET_KEY;
    const priceId = process.env.STRIPE_PRICE_ID;
    if (!secret || !priceId) {
      throw new Error("Stripe is not configured (STRIPE_SECRET_KEY + STRIPE_PRICE_ID).");
    }
    const siteUrl = process.env.SITE_URL || "https://daily-close-mvp.vercel.app";
    const successUrl = process.env.STRIPE_SUCCESS_URL || `${siteUrl}/billing?status=success`;
    const cancelUrl = process.env.STRIPE_CANCEL_URL || `${siteUrl}/billing?status=cancel`;
    const quantity = this.billableQuantity(await this.activeStoreCount(ownerId));

    const params = new URLSearchParams();
    params.set("mode", "subscription");
    params.set("success_url", successUrl);
    params.set("cancel_url", cancelUrl);
    params.set("customer_email", ownerEmail);
    params.set("client_reference_id", ownerId);
    params.set("subscription_data[metadata][ownerId]", ownerId);
    params.set("line_items[0][price]", priceId);
    params.set("line_items[0][quantity]", String(quantity));
    params.set("allow_promotion_codes", "true");

    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: params.toString()
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Stripe checkout failed: ${res.status} ${body.slice(0, 200)}`);
    }
    const data = (await res.json()) as { url?: string };
    if (!data.url) throw new Error("Stripe did not return a checkout URL.");
    return data.url;
  }

  async syncStoreQuantityForOwner(ownerId: string): Promise<{ synced: boolean; quantity: number }> {
    const owner = await this.prisma.owner.findUnique({ where: { id: ownerId } });
    if (!owner) throw new NotFoundException("Owner not found.");
    const quantity = this.billableQuantity(await this.activeStoreCount(ownerId));

    if (owner.subscriptionStatus !== "ACTIVE") {
      return { synced: false, quantity };
    }
    if (!process.env.STRIPE_SECRET_KEY || !owner.stripeSubscriptionId) {
      throw new Error("Stripe subscription is missing for active owner.");
    }

    const itemId = await this.fetchPrimarySubscriptionItemId(owner.stripeSubscriptionId);
    if (!itemId) {
      throw new Error("Stripe subscription item was not found.");
    }

    const params = new URLSearchParams();
    params.set("quantity", String(quantity));
    params.set("proration_behavior", "create_prorations");

    const res = await fetch(`https://api.stripe.com/v1/subscription_items/${itemId}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: params.toString()
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Stripe quantity update failed: ${res.status} ${body.slice(0, 200)}`);
    }
    return { synced: true, quantity };
  }

  private async fetchPrimarySubscriptionItemId(subscriptionId: string): Promise<string | null> {
    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret) return null;
    const res = await fetch(`https://api.stripe.com/v1/subscriptions/${subscriptionId}`, {
      headers: { Authorization: `Bearer ${secret}` }
    });
    if (!res.ok) {
      this.logger.warn(`Could not fetch Stripe subscription ${subscriptionId}: ${res.status}`);
      return null;
    }
    const data = await res.json() as any;
    return data?.items?.data?.[0]?.id ?? null;
  }

  private activeStoreCount(ownerId: string): Promise<number> {
    return this.prisma.store.count({ where: { ownerId, deletedAt: null } });
  }

  private billableQuantity(activeStoreCount: number): number {
    return Math.max(1, activeStoreCount);
  }
}

import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

export type SubscriptionStatus = "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELED";

export interface SubscriptionView {
  status: SubscriptionStatus;
  plan: string;
  trialEndsAt: string | null;
  daysLeftInTrial: number | null;
  active: boolean;
  stripeCustomerId: string | null;
  checkoutUrl: string | null;
  portalUrl: string | null;
}

@Injectable()
export class SubscriptionsService {
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
    return {
      status,
      plan: owner.subscriptionPlan,
      trialEndsAt: owner.trialEndsAt ? owner.trialEndsAt.toISOString() : null,
      daysLeftInTrial: SubscriptionsService.daysLeft(owner.trialEndsAt),
      active: SubscriptionsService.isActive(status, owner.trialEndsAt),
      stripeCustomerId: owner.stripeCustomerId,
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
    stripeCustomerId: string;
    stripeSubscriptionId?: string | null;
    status: string;
  }) {
    return this.prisma.owner.update({
      where: { stripeCustomerId: input.stripeCustomerId },
      data: {
        subscriptionStatus: input.status,
        stripeSubscriptionId: input.stripeSubscriptionId ?? undefined
      }
    });
  }
}

import { SubscriptionsService } from "./subscriptions.service";

describe("SubscriptionsService static logic", () => {
  it("isActive: ACTIVE is always active regardless of trialEndsAt", () => {
    expect(SubscriptionsService.isActive("ACTIVE", null)).toBe(true);
    expect(SubscriptionsService.isActive("ACTIVE", new Date(Date.now() - 1_000_000))).toBe(true);
  });

  it("isActive: TRIALING is active only while trialEndsAt is in the future", () => {
    expect(
      SubscriptionsService.isActive("TRIALING", new Date(Date.now() + 3 * 86_400_000))
    ).toBe(true);
    expect(
      SubscriptionsService.isActive("TRIALING", new Date(Date.now() - 86_400_000))
    ).toBe(false);
  });

  it("isActive: PAST_DUE and CANCELED are never active", () => {
    expect(SubscriptionsService.isActive("PAST_DUE", new Date(Date.now() + 86_400_000))).toBe(false);
    expect(SubscriptionsService.isActive("CANCELED", null)).toBe(false);
  });

  it("daysLeft returns null for missing trial and 0 for expired", () => {
    expect(SubscriptionsService.daysLeft(null)).toBeNull();
    expect(SubscriptionsService.daysLeft(new Date(Date.now() - 86_400_000))).toBe(0);
    expect(SubscriptionsService.daysLeft(new Date(Date.now() + 3.5 * 86_400_000))).toBeGreaterThanOrEqual(3);
  });
});

describe("SubscriptionsService.ensureActiveForOwner", () => {
  function buildService(owner: any) {
    const prisma = { owner: { findUnique: jest.fn().mockResolvedValue(owner) } } as any;
    return new SubscriptionsService(prisma);
  }

  it("passes when owner is ACTIVE", async () => {
    const service = buildService({ subscriptionStatus: "ACTIVE", trialEndsAt: null });
    await expect(service.ensureActiveForOwner("o1")).resolves.toBeUndefined();
  });

  it("throws PAYMENT_REQUIRED when trial is expired", async () => {
    const service = buildService({
      subscriptionStatus: "TRIALING",
      trialEndsAt: new Date(Date.now() - 86_400_000)
    });
    await expect(service.ensureActiveForOwner("o1")).rejects.toMatchObject({ statusCode: 402 });
  });
});

describe("SubscriptionsService.syncFromStripe", () => {
  it("links a first checkout payment to the owner id and preserves existing data", async () => {
    const prisma = {
      owner: {
        update: jest.fn().mockResolvedValue({})
      }
    } as any;
    const service = new SubscriptionsService(prisma);

    await service.syncFromStripe({
      ownerId: "owner-1",
      stripeCustomerId: "cus_123",
      stripeSubscriptionId: "sub_123",
      status: "ACTIVE"
    });

    expect(prisma.owner.update).toHaveBeenCalledWith({
      where: { id: "owner-1" },
      data: {
        subscriptionStatus: "ACTIVE",
        stripeCustomerId: "cus_123",
        stripeSubscriptionId: "sub_123"
      }
    });
  });
});

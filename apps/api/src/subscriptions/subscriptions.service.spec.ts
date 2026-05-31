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
    const prisma = {
      owner: { findUnique: jest.fn().mockResolvedValue(owner) },
      store: { count: jest.fn().mockResolvedValue(1) }
    } as any;
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

describe("SubscriptionsService Stripe quantities", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_PRICE_ID;
  });

  it("creates checkout with quantity equal to active store count", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test";
    process.env.STRIPE_PRICE_ID = "price_store";
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ url: "https://stripe.test/checkout" })
    });
    global.fetch = fetchMock as any;
    const service = new SubscriptionsService({
      store: { count: jest.fn().mockResolvedValue(3) }
    } as any);

    await expect(service.createCheckoutForOwner("owner-1", "owner@test.com")).resolves.toBe("https://stripe.test/checkout");
    const body = fetchMock.mock.calls[0][1].body as string;
    expect(body).toContain("line_items%5B0%5D%5Bquantity%5D=3");
  });

  it("updates the active Stripe subscription quantity with prorations", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test";
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: { data: [{ id: "si_123" }] } })
      })
      .mockResolvedValueOnce({ ok: true, text: async () => "" });
    global.fetch = fetchMock as any;
    const service = new SubscriptionsService({
      owner: {
        findUnique: jest.fn().mockResolvedValue({
          subscriptionStatus: "ACTIVE",
          stripeSubscriptionId: "sub_123"
        })
      },
      store: { count: jest.fn().mockResolvedValue(2) }
    } as any);

    await expect(service.syncStoreQuantityForOwner("owner-1")).resolves.toEqual({ synced: true, quantity: 2 });
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.stripe.com/v1/subscriptions/sub_123");
    expect(fetchMock.mock.calls[1][0]).toBe("https://api.stripe.com/v1/subscription_items/si_123");
    expect(fetchMock.mock.calls[1][1].body).toBe("quantity=2&proration_behavior=create_prorations");
  });

  it("blocks active owners when Stripe cannot confirm store billing", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test";
    const service = new SubscriptionsService({
      owner: {
        findUnique: jest.fn().mockResolvedValue({
          subscriptionStatus: "ACTIVE",
          stripeSubscriptionId: null
        })
      },
      store: { count: jest.fn().mockResolvedValue(2) }
    } as any);

    await expect(service.syncStoreQuantityForOwner("owner-1")).rejects.toThrow("Stripe subscription is missing");
  });
});

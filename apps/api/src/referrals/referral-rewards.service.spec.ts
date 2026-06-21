import { ReferralRewardStatus } from "@prisma/client";
import { ReferralRewardsService } from "./referral-rewards.service";

// Minimal Prisma + alert doubles. Each test wires only the methods it exercises.
function makePrisma(overrides: any = {}) {
  return {
    owner: { findUnique: jest.fn(), update: jest.fn() },
    partner: { findUnique: jest.fn() },
    referralReward: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn()
    },
    ...overrides
  };
}

function makeAlerts() {
  return { notifyLargeReward: jest.fn().mockResolvedValue(undefined) };
}

describe("ReferralRewardsService.recordFirstPaymentReward", () => {
  const originalEnv = { ...process.env };
  afterEach(() => {
    process.env = { ...originalEnv };
    jest.restoreAllMocks();
  });

  const baseInput = {
    referredStripeCustomerId: "cus_B",
    stripeInvoiceId: "in_1",
    amountPaidCents: 4999,
    storeCount: 1,
    unitAmountCents: 4999,
    currency: "usd"
  };

  it("skips a $0 / zero-quantity invoice", async () => {
    const prisma = makePrisma();
    const svc = new ReferralRewardsService(prisma as any, makeAlerts() as any);
    const res = await svc.recordFirstPaymentReward({ ...baseInput, storeCount: 0, amountPaidCents: 0 });
    expect(res).toEqual({ created: false, reason: "zero_amount" });
    expect(prisma.owner.findUnique).not.toHaveBeenCalled();
  });

  it("does NOT reward a $0 trial invoice even when the line carries a list price", async () => {
    const prisma = makePrisma();
    const svc = new ReferralRewardsService(prisma as any, makeAlerts() as any);
    // amount_paid 0 (trial) but the line still has unit_amount 4999.
    const res = await svc.recordFirstPaymentReward({ ...baseInput, amountPaidCents: 0 });
    expect(res).toEqual({ created: false, reason: "zero_amount" });
    expect(prisma.owner.findUnique).not.toHaveBeenCalled();
  });

  it("skips an owner who wasn't referred by another owner", async () => {
    const prisma = makePrisma();
    prisma.owner.findUnique.mockResolvedValue({
      id: "B",
      referredByOwnerId: null,
      referredByOwner: null
    });
    const svc = new ReferralRewardsService(prisma as any, makeAlerts() as any);
    const res = await svc.recordFirstPaymentReward(baseInput);
    expect(res).toEqual({ created: false, reason: "not_referred" });
  });

  it("only rewards the FIRST payment (no second reward for the same referee)", async () => {
    const prisma = makePrisma();
    prisma.owner.findUnique.mockResolvedValue({
      id: "B",
      referredByOwnerId: "A",
      referredByOwner: { id: "A", stripeCustomerId: "cus_A" }
    });
    prisma.referralReward.findFirst.mockResolvedValue({ id: "existing" });
    const svc = new ReferralRewardsService(prisma as any, makeAlerts() as any);
    const res = await svc.recordFirstPaymentReward(baseInput);
    expect(res).toEqual({ created: false, reason: "already_rewarded" });
    expect(prisma.referralReward.create).not.toHaveBeenCalled();
  });

  it("mints + applies a credit when the referrer has a Stripe customer", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test";
    const prisma = makePrisma();
    prisma.owner.findUnique.mockResolvedValue({
      id: "B",
      referredByOwnerId: "A",
      referredByOwner: { id: "A", stripeCustomerId: "cus_A" }
    });
    prisma.referralReward.findFirst.mockResolvedValue(null);
    prisma.referralReward.create.mockResolvedValue({ id: "rw1" });
    prisma.referralReward.update.mockResolvedValue({});
    const fetchMock = jest
      .spyOn(global, "fetch" as any)
      .mockResolvedValue({ ok: true, json: async () => ({ id: "cbtxn_1" }) } as any);

    const svc = new ReferralRewardsService(prisma as any, makeAlerts() as any);
    const res = await svc.recordFirstPaymentReward({ ...baseInput, storeCount: 2 });

    expect(res).toEqual({
      created: true,
      rewardId: "rw1",
      amountCents: 9998,
      status: ReferralRewardStatus.APPLIED
    });
    // Negative amount = a credit on the referrer's balance.
    const body = (fetchMock.mock.calls[0][1] as any).body as string;
    expect(body).toContain("amount=-9998");
    expect(fetchMock.mock.calls[0][0]).toContain("/customers/cus_A/balance_transactions");
    expect(prisma.referralReward.update).toHaveBeenCalledWith({
      where: { id: "rw1" },
      data: { status: ReferralRewardStatus.APPLIED, stripeBalanceTxnId: "cbtxn_1" }
    });
  });

  it("leaves the reward PENDING when the referrer has no Stripe customer yet", async () => {
    const prisma = makePrisma();
    prisma.owner.findUnique.mockResolvedValue({
      id: "B",
      referredByOwnerId: "A",
      referredByOwner: { id: "A", stripeCustomerId: null }
    });
    prisma.referralReward.findFirst.mockResolvedValue(null);
    prisma.referralReward.create.mockResolvedValue({ id: "rw2" });
    const fetchMock = jest.spyOn(global, "fetch" as any);

    const svc = new ReferralRewardsService(prisma as any, makeAlerts() as any);
    const res = await svc.recordFirstPaymentReward(baseInput);

    expect(res).toMatchObject({ created: true, status: ReferralRewardStatus.PENDING });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(prisma.referralReward.update).not.toHaveBeenCalled();
  });

  it("fires a large-reward alert above the threshold", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test";
    process.env.REFERRAL_ALERT_CENTS = "20000";
    const prisma = makePrisma();
    prisma.owner.findUnique.mockResolvedValue({
      id: "B",
      referredByOwnerId: "A",
      referredByOwner: { id: "A", stripeCustomerId: "cus_A" }
    });
    prisma.referralReward.findFirst.mockResolvedValue(null);
    prisma.referralReward.create.mockResolvedValue({ id: "rw3" });
    prisma.referralReward.update.mockResolvedValue({});
    jest
      .spyOn(global, "fetch" as any)
      .mockResolvedValue({ ok: true, json: async () => ({ id: "cbtxn_3" }) } as any);
    const alerts = makeAlerts();

    const svc = new ReferralRewardsService(prisma as any, alerts as any);
    // 5 stores × $49.99 = $249.95 ≥ $200 threshold.
    await svc.recordFirstPaymentReward({ ...baseInput, storeCount: 5 });

    expect(alerts.notifyLargeReward).toHaveBeenCalledTimes(1);
  });
});

describe("ReferralRewardsService.reverseByInvoice", () => {
  const originalEnv = { ...process.env };
  afterEach(() => {
    process.env = { ...originalEnv };
    jest.restoreAllMocks();
  });

  it("debits back an APPLIED credit and marks it reversed", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test";
    const prisma = makePrisma();
    prisma.referralReward.findUnique.mockResolvedValue({
      id: "rw1",
      status: ReferralRewardStatus.APPLIED,
      amountCents: 9998,
      currency: "usd",
      referrerOwner: { stripeCustomerId: "cus_A" }
    });
    prisma.referralReward.update.mockResolvedValue({});
    const fetchMock = jest
      .spyOn(global, "fetch" as any)
      .mockResolvedValue({ ok: true, json: async () => ({ id: "cbtxn_rev" }) } as any);

    const svc = new ReferralRewardsService(prisma as any, makeAlerts() as any);
    const res = await svc.reverseByInvoice("in_1");

    expect(res).toEqual({ reversed: true });
    // Positive amount = debit = removes the previously granted credit.
    const body = (fetchMock.mock.calls[0][1] as any).body as string;
    expect(body).toContain("amount=9998");
    expect(prisma.referralReward.update).toHaveBeenCalledWith({
      where: { id: "rw1" },
      data: { status: ReferralRewardStatus.REVERSED }
    });
  });

  it("is a no-op when there's no reward for the invoice", async () => {
    const prisma = makePrisma();
    prisma.referralReward.findUnique.mockResolvedValue(null);
    const svc = new ReferralRewardsService(prisma as any, makeAlerts() as any);
    expect(await svc.reverseByInvoice("in_none")).toEqual({ reversed: false });
  });
});

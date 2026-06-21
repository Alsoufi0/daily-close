import { SubscriptionsController } from "./subscriptions.controller";

describe("SubscriptionsController webhook", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  function makeController() {
    const subscriptions = {
      syncFromStripe: jest.fn().mockResolvedValue({}),
      createCheckoutForOwner: jest.fn(),
      getForOwner: jest.fn()
    };
    const commissions = {
      recordInvoicePayment: jest.fn().mockResolvedValue({ created: true, commissionId: "c1" }),
      reverseByInvoice: jest.fn().mockResolvedValue({ reversed: true })
    };
    const referralRewards = {
      recordFirstPaymentReward: jest.fn().mockResolvedValue({ created: false, reason: "not_referred" }),
      reverseByInvoice: jest.fn().mockResolvedValue({ reversed: false }),
      flushPendingForReferrer: jest.fn().mockResolvedValue({ applied: 0 })
    };
    const controller = new SubscriptionsController(
      subscriptions as any,
      commissions as any,
      referralRewards as any
    );
    return { controller, subscriptions, commissions, referralRewards };
  }

  it("activates a first checkout session by owner id", async () => {
    process.env = { ...originalEnv, NODE_ENV: "test" };
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const { controller, subscriptions } = makeController();

    await expect(
      controller.webhook(
        {} as any,
        {
          type: "checkout.session.completed",
          data: {
            object: {
              customer: "cus_123",
              subscription: "sub_123",
              client_reference_id: "owner-1"
            }
          }
        },
        undefined
      )
    ).resolves.toEqual({ received: true });

    expect(subscriptions.syncFromStripe).toHaveBeenCalledWith({
      ownerId: "owner-1",
      stripeCustomerId: "cus_123",
      stripeSubscriptionId: "sub_123",
      status: "ACTIVE"
    });
  });

  it("records a commission on invoice.payment_succeeded", async () => {
    process.env = { ...originalEnv, NODE_ENV: "test" };
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const { controller, subscriptions, commissions } = makeController();

    await expect(
      controller.webhook(
        {} as any,
        {
          type: "invoice.payment_succeeded",
          data: {
            object: {
              id: "in_123",
              customer: "cus_123",
              amount_paid: 4999,
              currency: "usd",
              period_start: 1_780_000_000
            }
          }
        },
        undefined
      )
    ).resolves.toEqual({ received: true });

    expect(commissions.recordInvoicePayment).toHaveBeenCalledWith({
      stripeInvoiceId: "in_123",
      stripeCustomerId: "cus_123",
      amountPaidCents: 4999,
      currency: "usd",
      periodStartUnix: 1_780_000_000
    });
    // A payment event is not a subscription-status sync.
    expect(subscriptions.syncFromStripe).not.toHaveBeenCalled();
  });

  it("reverses a commission on charge.refunded", async () => {
    process.env = { ...originalEnv, NODE_ENV: "test" };
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const { controller, commissions } = makeController();

    await expect(
      controller.webhook(
        {} as any,
        { type: "charge.refunded", data: { object: { invoice: "in_123" } } },
        undefined
      )
    ).resolves.toEqual({ received: true });

    expect(commissions.reverseByInvoice).toHaveBeenCalledWith("in_123");
  });

  it("mints an owner→owner referral reward from the invoice quantity + unit price", async () => {
    process.env = { ...originalEnv, NODE_ENV: "test", STRIPE_PRICE_ID: "price_store" };
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const { controller, referralRewards } = makeController();

    await controller.webhook(
      {} as any,
      {
        type: "invoice.payment_succeeded",
        data: {
          object: {
            id: "in_777",
            customer: "cus_B",
            amount_paid: 9998,
            currency: "usd",
            lines: { data: [{ quantity: 2, price: { id: "price_store", unit_amount: 4999 } }] }
          }
        }
      },
      undefined
    );

    expect(referralRewards.recordFirstPaymentReward).toHaveBeenCalledWith({
      referredStripeCustomerId: "cus_B",
      stripeInvoiceId: "in_777",
      amountPaidCents: 9998,
      storeCount: 2,
      unitAmountCents: 4999,
      currency: "usd"
    });
  });

  it("reverses a referral reward on charge.refunded", async () => {
    process.env = { ...originalEnv, NODE_ENV: "test" };
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const { controller, referralRewards } = makeController();

    await controller.webhook(
      {} as any,
      { type: "charge.refunded", data: { object: { invoice: "in_777" } } },
      undefined
    );

    expect(referralRewards.reverseByInvoice).toHaveBeenCalledWith("in_777");
  });

  it("flushes pending referral credit when a checkout links the owner", async () => {
    process.env = { ...originalEnv, NODE_ENV: "test" };
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const { controller, referralRewards } = makeController();

    await controller.webhook(
      {} as any,
      {
        type: "checkout.session.completed",
        data: { object: { customer: "cus_A", subscription: "sub_A", client_reference_id: "owner-A" } }
      },
      undefined
    );

    expect(referralRewards.flushPendingForReferrer).toHaveBeenCalledWith("owner-A");
  });
});

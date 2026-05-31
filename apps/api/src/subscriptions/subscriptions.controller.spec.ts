import { SubscriptionsController } from "./subscriptions.controller";

describe("SubscriptionsController webhook", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("activates a first checkout session by owner id", async () => {
    process.env = { ...originalEnv, NODE_ENV: "test" };
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const subscriptions = {
      syncFromStripe: jest.fn().mockResolvedValue({}),
      createCheckoutForOwner: jest.fn(),
      getForOwner: jest.fn()
    };
    const controller = new SubscriptionsController(subscriptions as any);

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
});

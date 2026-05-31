import { HttpException } from "@nestjs/common";
import { SubscriptionGuard } from "./subscription.guard";

function contextFor(user: any) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user })
    })
  } as any;
}

describe("SubscriptionGuard", () => {
  it("blocks expired account owners with payment required", async () => {
    const subscriptions = {
      ensureActiveForOwner: jest.fn().mockRejectedValue({ statusCode: 402 })
    };
    const guard = new SubscriptionGuard(subscriptions as any);

    await expect(
      guard.canActivate(contextFor({ role: "STORE_OWNER", ownerId: "owner-1" }))
    ).rejects.toBeInstanceOf(HttpException);
    expect(subscriptions.ensureActiveForOwner).toHaveBeenCalledWith("owner-1");
  });

  it("checks per-store managers against the owner subscription", async () => {
    const subscriptions = { ensureActiveForOwner: jest.fn().mockResolvedValue(undefined) };
    const guard = new SubscriptionGuard(subscriptions as any);

    await expect(
      guard.canActivate(contextFor({ role: "EMPLOYEE", ownerId: "owner-1", managedStoreIds: ["s1"] }))
    ).resolves.toBe(true);
    expect(subscriptions.ensureActiveForOwner).toHaveBeenCalledWith("owner-1");
  });

  it("does not block plain employees from closing stores", async () => {
    const subscriptions = { ensureActiveForOwner: jest.fn() };
    const guard = new SubscriptionGuard(subscriptions as any);

    await expect(
      guard.canActivate(contextFor({ role: "EMPLOYEE", ownerId: "owner-1", managedStoreIds: [] }))
    ).resolves.toBe(true);
    expect(subscriptions.ensureActiveForOwner).not.toHaveBeenCalled();
  });
});

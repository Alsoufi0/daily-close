import { UnauthorizedException, ExecutionContext } from "@nestjs/common";
import { SupabaseAuthGuard } from "./supabase-auth.guard";

function ctx(headers: Record<string, string | undefined>) {
  const req: any = { headers };
  return {
    switchToHttp: () => ({ getRequest: () => req }),
    request: req
  } as unknown as ExecutionContext & { request: any };
}

describe("SupabaseAuthGuard", () => {
  it("throws Unauthorized when no bearer token is present", async () => {
    const authService = { getUserFromToken: jest.fn() };
    const guard = new SupabaseAuthGuard(authService as any);
    await expect(guard.canActivate(ctx({}) as any)).rejects.toThrow(UnauthorizedException);
  });

  it("calls auth.getUserFromToken when a bearer token is present", async () => {
    const fakeUser = { id: "u-1", role: "STORE_OWNER" };
    const authService = {
      getUserFromToken: jest.fn().mockResolvedValue(fakeUser)
    };
    const guard = new SupabaseAuthGuard(authService as any);
    const c = ctx({ authorization: "Bearer abc.def.ghi" }) as any;
    await expect(guard.canActivate(c)).resolves.toBe(true);
    expect(authService.getUserFromToken).toHaveBeenCalledWith("abc.def.ghi");
    expect(c.request.user).toBe(fakeUser);
  });

  it("ignores x-demo-role header entirely (demo backdoor was removed for security)", async () => {
    const authService = { getUserFromToken: jest.fn() };
    const guard = new SupabaseAuthGuard(authService as any);
    // Both with and without ALLOW_DEMO_AUTH set — should fail identically because
    // the guard no longer reads that env var.
    process.env.ALLOW_DEMO_AUTH = "true";
    try {
      await expect(
        guard.canActivate(ctx({ "x-demo-role": "owner" }) as any)
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        guard.canActivate(ctx({ "x-demo-role": "employee" }) as any)
      ).rejects.toThrow(UnauthorizedException);
    } finally {
      delete process.env.ALLOW_DEMO_AUTH;
    }
    expect(authService.getUserFromToken).not.toHaveBeenCalled();
  });
});

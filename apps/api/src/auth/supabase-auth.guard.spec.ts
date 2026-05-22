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
  const originalEnv = process.env.ALLOW_DEMO_AUTH;

  afterEach(() => {
    process.env.ALLOW_DEMO_AUTH = originalEnv;
  });

  it("throws Unauthorized when no bearer token is present", async () => {
    delete process.env.ALLOW_DEMO_AUTH;
    const authService = {
      getUserFromToken: jest.fn(),
      getDemoUser: jest.fn()
    };
    const guard = new SupabaseAuthGuard(authService as any);
    await expect(guard.canActivate(ctx({}) as any)).rejects.toThrow(UnauthorizedException);
  });

  it("calls auth.getUserFromToken when a bearer token is present", async () => {
    delete process.env.ALLOW_DEMO_AUTH;
    const fakeUser = { id: "u-1", role: "STORE_OWNER" };
    const authService = {
      getUserFromToken: jest.fn().mockResolvedValue(fakeUser),
      getDemoUser: jest.fn()
    };
    const guard = new SupabaseAuthGuard(authService as any);
    const c = ctx({ authorization: "Bearer abc.def.ghi" }) as any;
    await expect(guard.canActivate(c)).resolves.toBe(true);
    expect(authService.getUserFromToken).toHaveBeenCalledWith("abc.def.ghi");
    expect(c.request.user).toBe(fakeUser);
  });

  it("blocks demo-role header when ALLOW_DEMO_AUTH is not 'true'", async () => {
    process.env.ALLOW_DEMO_AUTH = "false";
    const authService = {
      getUserFromToken: jest.fn(),
      getDemoUser: jest.fn().mockResolvedValue({ id: "demo" })
    };
    const guard = new SupabaseAuthGuard(authService as any);
    await expect(
      guard.canActivate(ctx({ "x-demo-role": "owner" }) as any)
    ).rejects.toThrow(UnauthorizedException);
    expect(authService.getDemoUser).not.toHaveBeenCalled();
  });

  it("accepts demo-role header only when ALLOW_DEMO_AUTH is 'true'", async () => {
    process.env.ALLOW_DEMO_AUTH = "true";
    const demoUser = { id: "demo-owner", role: "STORE_OWNER" };
    const authService = {
      getUserFromToken: jest.fn(),
      getDemoUser: jest.fn().mockResolvedValue(demoUser)
    };
    const guard = new SupabaseAuthGuard(authService as any);
    const c = ctx({ "x-demo-role": "owner" }) as any;
    await expect(guard.canActivate(c)).resolves.toBe(true);
    expect(authService.getDemoUser).toHaveBeenCalledWith("owner");
    expect(c.request.user).toBe(demoUser);
  });
});

import { ForbiddenException } from "@nestjs/common";
import { createHmac } from "crypto";
import { SmsWebhookController } from "./sms-webhook.controller";

describe("SmsWebhookController", () => {
  const originalEnv = { ...process.env };
  let prisma: { phoneConsent: { updateMany: jest.Mock } };
  let controller: SmsWebhookController;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.NODE_ENV;
    delete process.env.TWILIO_AUTH_TOKEN;
    prisma = {
      phoneConsent: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) }
    };
    controller = new SmsWebhookController(prisma as any);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  function makeReq(url = "/sms/webhook", host = "api.example.com", proto = "https") {
    return {
      protocol: proto,
      originalUrl: url,
      url,
      headers: {
        host,
        "x-forwarded-host": host,
        "x-forwarded-proto": proto
      }
    } as any;
  }

  function signFor(token: string, fullUrl: string, params: Record<string, string>) {
    const sorted = Object.keys(params)
      .sort()
      .map((k) => `${k}${params[k]}`)
      .join("");
    return createHmac("sha1", token).update(fullUrl + sorted).digest("base64");
  }

  it("STOP from a phone marks all active consent rows as opted-out", async () => {
    const body = { From: "+15551234567", Body: "STOP" };
    const result = await controller.inbound(makeReq(), undefined, body);
    expect(result).toBe("<Response></Response>");
    expect(prisma.phoneConsent.updateMany).toHaveBeenCalledWith({
      where: { phone: "+15551234567", optedOutAt: null },
      data: { optedOutAt: expect.any(Date) }
    });
  });

  it("handles every CTIA opt-out keyword case-insensitively", async () => {
    for (const word of ["stop", "StopAll", "UNSUBSCRIBE", "  cancel  ", "End", "quit"]) {
      prisma.phoneConsent.updateMany.mockClear();
      await controller.inbound(makeReq(), undefined, { From: "+1555", Body: word });
      expect(prisma.phoneConsent.updateMany).toHaveBeenCalledTimes(1);
    }
  });

  it("non-STOP inbound is logged but does NOT flip opt-out", async () => {
    await controller.inbound(makeReq(), undefined, { From: "+1555", Body: "hello there" });
    expect(prisma.phoneConsent.updateMany).not.toHaveBeenCalled();
  });

  it("STOPPED (a word containing STOP) does NOT opt the user out", async () => {
    await controller.inbound(makeReq(), undefined, { From: "+1555", Body: "stopped raining" });
    expect(prisma.phoneConsent.updateMany).not.toHaveBeenCalled();
  });

  it("in production with a valid X-Twilio-Signature, STOP is processed", async () => {
    process.env.NODE_ENV = "production";
    process.env.TWILIO_AUTH_TOKEN = "secret-token";
    const body = { From: "+15551234567", Body: "STOP" };
    const url = "https://api.example.com/sms/webhook";
    const sig = signFor("secret-token", url, body);

    const result = await controller.inbound(makeReq(), sig, body);
    expect(result).toBe("<Response></Response>");
    expect(prisma.phoneConsent.updateMany).toHaveBeenCalled();
  });

  it("in production with an invalid signature, returns 403 and does NOT process", async () => {
    process.env.NODE_ENV = "production";
    process.env.TWILIO_AUTH_TOKEN = "secret-token";
    await expect(
      controller.inbound(makeReq(), "totally-wrong-signature-AAAA", {
        From: "+1555",
        Body: "STOP"
      })
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.phoneConsent.updateMany).not.toHaveBeenCalled();
  });

  it("in production with no signature header, returns 403", async () => {
    process.env.NODE_ENV = "production";
    process.env.TWILIO_AUTH_TOKEN = "secret-token";
    await expect(
      controller.inbound(makeReq(), undefined, { From: "+1555", Body: "STOP" })
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("in dev with an invalid signature, accepts and warns (does NOT 403)", async () => {
    process.env.NODE_ENV = "development";
    process.env.TWILIO_AUTH_TOKEN = "secret-token";
    const result = await controller.inbound(makeReq(), "bad-sig", {
      From: "+1555",
      Body: "STOP"
    });
    expect(result).toBe("<Response></Response>");
    expect(prisma.phoneConsent.updateMany).toHaveBeenCalled();
  });
});

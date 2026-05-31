import { SmsService, SMS_COMPLIANCE_FOOTER } from "./sms.service";

describe("SmsService", () => {
  const original = { ...process.env };
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    process.env = { ...original };
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_MESSAGING_SERVICE_SID;
    delete process.env.TWILIO_FROM_NUMBER;
    delete process.env.TWILIO_DELIVERY_CHANNEL;
    delete process.env.TWILIO_CHANNEL;
    delete process.env.TWILIO_WHATSAPP_FROM;
    delete process.env.APP_URL;
    fetchSpy = jest.spyOn(globalThis, "fetch" as any);
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    process.env = original;
  });

  it("isConfigured is false when env vars are missing", () => {
    expect(new SmsService().isConfigured()).toBe(false);
  });

  it("isConfigured needs both creds AND a sender (messaging service OR from number)", () => {
    process.env.TWILIO_ACCOUNT_SID = "AC123";
    process.env.TWILIO_AUTH_TOKEN = "token";
    expect(new SmsService().isConfigured()).toBe(false);
    process.env.TWILIO_FROM_NUMBER = "+15551234567";
    expect(new SmsService().isConfigured()).toBe(true);
  });

  it("send() is a no-op (returns sent=false) when not configured", async () => {
    const result = await new SmsService().send("+15551234567", "hi");
    expect(result).toEqual({ sent: false, error: "SMS not configured" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("send() posts To/Body/MessagingServiceSid with HTTP Basic auth", async () => {
    process.env.TWILIO_ACCOUNT_SID = "AC123";
    process.env.TWILIO_AUTH_TOKEN = "token";
    process.env.TWILIO_MESSAGING_SERVICE_SID = "MG999";
    fetchSpy.mockResolvedValue({ ok: true } as any);

    const result = await new SmsService().send("+15551234567", "hello world");
    expect(result).toEqual({ sent: true });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toContain("/Accounts/AC123/Messages.json");
    const headers = (init as any).headers;
    expect(headers.Authorization).toMatch(/^Basic [A-Za-z0-9+/=]+$/);
    expect(headers["Content-Type"]).toBe("application/x-www-form-urlencoded");
    const params = new URLSearchParams((init as any).body);
    expect(params.get("To")).toBe("+15551234567");
    expect(params.get("Body")).toBe("hello world");
    expect(params.get("MessagingServiceSid")).toBe("MG999");
    expect(params.get("From")).toBeNull();
  });

  it("send() falls back to From when MessagingServiceSid is unset", async () => {
    process.env.TWILIO_ACCOUNT_SID = "AC123";
    process.env.TWILIO_AUTH_TOKEN = "token";
    process.env.TWILIO_FROM_NUMBER = "+15550001234";
    fetchSpy.mockResolvedValue({ ok: true } as any);

    await new SmsService().send("+15551234567", "x");
    const params = new URLSearchParams(fetchSpy.mock.calls[0][1].body);
    expect(params.get("From")).toBe("+15550001234");
    expect(params.get("MessagingServiceSid")).toBeNull();
  });

  it("send() can route Twilio messages over WhatsApp while SMS verification is pending", async () => {
    process.env.TWILIO_ACCOUNT_SID = "AC123";
    process.env.TWILIO_AUTH_TOKEN = "token";
    process.env.TWILIO_DELIVERY_CHANNEL = "whatsapp";
    process.env.TWILIO_WHATSAPP_FROM = "whatsapp:+15550009999";
    fetchSpy.mockResolvedValue({ ok: true } as any);

    await new SmsService().send("+15551234567", "x");
    const params = new URLSearchParams(fetchSpy.mock.calls[0][1].body);
    expect(params.get("To")).toBe("whatsapp:+15551234567");
    expect(params.get("From")).toBe("whatsapp:+15550009999");
  });

  it("send() can route WhatsApp through a Twilio Messaging Service", async () => {
    process.env.TWILIO_ACCOUNT_SID = "AC123";
    process.env.TWILIO_AUTH_TOKEN = "token";
    process.env.TWILIO_DELIVERY_CHANNEL = "whatsapp";
    process.env.TWILIO_MESSAGING_SERVICE_SID = "MG_WHATSAPP";
    fetchSpy.mockResolvedValue({ ok: true } as any);

    await new SmsService().send("+15551234567", "x");
    const params = new URLSearchParams(fetchSpy.mock.calls[0][1].body);
    expect(params.get("To")).toBe("whatsapp:+15551234567");
    expect(params.get("MessagingServiceSid")).toBe("MG_WHATSAPP");
    expect(params.get("From")).toBeNull();
  });

  it("send() returns sent=false with the status when Twilio rejects", async () => {
    process.env.TWILIO_ACCOUNT_SID = "AC123";
    process.env.TWILIO_AUTH_TOKEN = "token";
    process.env.TWILIO_FROM_NUMBER = "+15550001234";
    fetchSpy.mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => "bad request"
    } as any);
    const result = await new SmsService().send("+15551234567", "x");
    expect(result.sent).toBe(false);
    expect(result.error).toMatch(/Twilio 400/);
  });

  it("sendEmployeeWelcome composes a message containing the name, store, app URL and password", async () => {
    process.env.TWILIO_ACCOUNT_SID = "AC123";
    process.env.TWILIO_AUTH_TOKEN = "token";
    process.env.TWILIO_FROM_NUMBER = "+15550001234";
    process.env.APP_URL = "https://app.example.com/";
    fetchSpy.mockResolvedValue({ ok: true } as any);

    const result = await new SmsService().sendEmployeeWelcome({
      phone: "+15551234567",
      name: "Maya",
      storeName: "Brooklyn Smoke",
      tempPassword: "abc!Pass123"
    });
    expect(result.sent).toBe(true);
    const params = new URLSearchParams(fetchSpy.mock.calls[0][1].body);
    const body = params.get("Body") || "";
    expect(body).toContain("Maya");
    expect(body).toContain("Brooklyn Smoke");
    expect(body).toContain("abc!Pass123");
    // Trailing slash should be normalized away.
    expect(body).toContain("https://app.example.com/close");
    expect(body).not.toContain("app.example.com//close");
    // A2P 10DLC: the compliance footer MUST be on its own line at the end.
    expect(body.endsWith(`\n${SMS_COMPLIANCE_FOOTER}`)).toBe(true);
    expect(body).toContain(
      "Reply STOP to unsubscribe. HELP for help. Msg & data rates may apply."
    );
  });

  it("SMS_COMPLIANCE_FOOTER is the exact carrier-required disclaimer text", () => {
    expect(SMS_COMPLIANCE_FOOTER).toBe(
      "Reply STOP to unsubscribe. HELP for help. Msg & data rates may apply."
    );
  });

  it("sendEmployeeWelcome refuses to send when no active consent exists", async () => {
    process.env.TWILIO_ACCOUNT_SID = "AC123";
    process.env.TWILIO_AUTH_TOKEN = "token";
    process.env.TWILIO_FROM_NUMBER = "+15550001234";
    fetchSpy.mockResolvedValue({ ok: true } as any);
    const prisma = {
      phoneConsent: { findFirst: jest.fn().mockResolvedValue(null) }
    } as any;
    const svc = new SmsService(prisma);
    const result = await svc.sendEmployeeWelcome({
      phone: "+15551234567",
      name: "Maya",
      storeName: "Store",
      tempPassword: "x"
    });
    expect(result.sent).toBe(false);
    expect(result.error).toMatch(/consent/i);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("sendEmployeeWelcome sends when an active consent row exists", async () => {
    process.env.TWILIO_ACCOUNT_SID = "AC123";
    process.env.TWILIO_AUTH_TOKEN = "token";
    process.env.TWILIO_FROM_NUMBER = "+15550001234";
    fetchSpy.mockResolvedValue({ ok: true } as any);
    const prisma = {
      phoneConsent: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: "c1", phone: "+15551234567", optedOutAt: null })
      }
    } as any;
    const svc = new SmsService(prisma);
    const result = await svc.sendEmployeeWelcome({
      phone: "+15551234567",
      name: "Maya",
      storeName: "Store",
      tempPassword: "x"
    });
    expect(result.sent).toBe(true);
    expect(prisma.phoneConsent.findFirst).toHaveBeenCalledWith({
      where: { phone: "+15551234567", optedOutAt: null }
    });
  });
});

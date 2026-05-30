import { createHmac } from "crypto";
import { StripeSignatureError, verifyStripeSignature } from "./stripe-signature";

const SECRET = "whsec_test_secret";

function sign(rawBody: string, timestamp: number, secret = SECRET): string {
  const v1 = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`, "utf8").digest("hex");
  return `t=${timestamp},v1=${v1}`;
}

describe("verifyStripeSignature", () => {
  const body = JSON.stringify({ type: "customer.subscription.updated", data: { object: {} } });
  const now = 1_900_000_000_000; // fixed clock (ms)
  const ts = Math.floor(now / 1000);

  it("accepts a correctly signed payload", () => {
    expect(() =>
      verifyStripeSignature({
        rawBody: body,
        signatureHeader: sign(body, ts),
        secret: SECRET,
        nowMs: now
      })
    ).not.toThrow();
  });

  it("accepts a Buffer raw body", () => {
    expect(() =>
      verifyStripeSignature({
        rawBody: Buffer.from(body, "utf8"),
        signatureHeader: sign(body, ts),
        secret: SECRET,
        nowMs: now
      })
    ).not.toThrow();
  });

  it("rejects a forged payload signed with the wrong secret", () => {
    expect(() =>
      verifyStripeSignature({
        rawBody: body,
        signatureHeader: sign(body, ts, "whsec_attacker"),
        secret: SECRET,
        nowMs: now
      })
    ).toThrow(StripeSignatureError);
  });

  it("rejects when the body is tampered after signing", () => {
    const header = sign(body, ts);
    const tampered = JSON.stringify({ type: "customer.subscription.updated", data: { object: { status: "active" } } });
    expect(() =>
      verifyStripeSignature({ rawBody: tampered, signatureHeader: header, secret: SECRET, nowMs: now })
    ).toThrow(StripeSignatureError);
  });

  it("rejects a replayed event outside the tolerance window", () => {
    const oldTs = ts - 600; // 10 min ago, default tolerance is 300s
    expect(() =>
      verifyStripeSignature({
        rawBody: body,
        signatureHeader: sign(body, oldTs),
        secret: SECRET,
        nowMs: now
      })
    ).toThrow(/tolerance/);
  });

  it("rejects a missing signature header", () => {
    expect(() =>
      verifyStripeSignature({ rawBody: body, signatureHeader: undefined, secret: SECRET, nowMs: now })
    ).toThrow(/Missing/);
  });

  it("rejects a malformed signature header", () => {
    expect(() =>
      verifyStripeSignature({ rawBody: body, signatureHeader: "garbage", secret: SECRET, nowMs: now })
    ).toThrow(/Malformed/);
  });

  it("rejects when the raw body was not captured", () => {
    expect(() =>
      verifyStripeSignature({ rawBody: undefined, signatureHeader: sign(body, ts), secret: SECRET, nowMs: now })
    ).toThrow(/Raw request body/);
  });
});

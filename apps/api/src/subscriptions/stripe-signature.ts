import { createHmac, timingSafeEqual } from "crypto";

/**
 * Stripe webhook signature verification — see
 * https://docs.stripe.com/webhooks#verify-manually
 *
 * We deliberately do NOT pull in the full `stripe` SDK (the rest of this app
 * talks to Stripe over plain `fetch`, see subscriptions.service.ts). Stripe's
 * scheme is small and well-documented, so we implement the same check the SDK's
 * `constructEvent` does, using Node's built-in crypto:
 *
 *   1. Parse the `Stripe-Signature` header: `t=<unix>,v1=<hex>,v1=<hex>,...`
 *   2. signed_payload = `${t}.${rawBody}`
 *   3. expected = HMAC-SHA256(secret, signed_payload) as hex
 *   4. constant-time compare against each provided `v1` candidate
 *   5. reject if the timestamp is older than the tolerance window (replay guard)
 *
 * Throws StripeSignatureError on any failure; the caller decides the HTTP
 * response. The raw request body bytes are required — a JSON-reparsed body
 * will not match because key ordering / whitespace differ from what Stripe
 * signed.
 */
export class StripeSignatureError extends Error {}

export interface VerifyStripeSignatureOptions {
  /** Exact bytes Stripe POSTed. A reparsed/restringified body will not match. */
  rawBody: Buffer | string | undefined;
  /** Value of the `Stripe-Signature` request header. */
  signatureHeader: string | undefined;
  /** STRIPE_WEBHOOK_SECRET (`whsec_...`). */
  secret: string;
  /** Replay-protection window in seconds. Stripe's SDK default is 300. */
  toleranceSeconds?: number;
  /** Injectable clock for tests. Defaults to Date.now(). */
  nowMs?: number;
}

const DEFAULT_TOLERANCE_SECONDS = 300;

export function verifyStripeSignature(opts: VerifyStripeSignatureOptions): void {
  const { rawBody, signatureHeader, secret } = opts;
  const tolerance = opts.toleranceSeconds ?? DEFAULT_TOLERANCE_SECONDS;
  const nowMs = opts.nowMs ?? Date.now();

  if (rawBody === undefined || rawBody === null) {
    throw new StripeSignatureError("Raw request body unavailable for signature check.");
  }
  if (!signatureHeader) {
    throw new StripeSignatureError("Missing Stripe-Signature header.");
  }

  let timestamp: number | null = null;
  const v1: string[] = [];
  for (const part of signatureHeader.split(",")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (key === "t") timestamp = Number(value);
    else if (key === "v1") v1.push(value);
  }

  if (timestamp === null || !Number.isFinite(timestamp) || v1.length === 0) {
    throw new StripeSignatureError("Malformed Stripe-Signature header.");
  }

  if (Math.abs(nowMs / 1000 - timestamp) > tolerance) {
    throw new StripeSignatureError(
      "Stripe-Signature timestamp outside tolerance (possible replay)."
    );
  }

  const payload = typeof rawBody === "string" ? rawBody : rawBody.toString("utf8");
  const expectedHex = createHmac("sha256", secret)
    .update(`${timestamp}.${payload}`, "utf8")
    .digest("hex");
  const expectedBuf = Buffer.from(expectedHex, "hex");

  const matched = v1.some((candidate) => {
    let candidateBuf: Buffer;
    try {
      candidateBuf = Buffer.from(candidate, "hex");
    } catch {
      return false;
    }
    return (
      candidateBuf.length === expectedBuf.length && timingSafeEqual(candidateBuf, expectedBuf)
    );
  });

  if (!matched) {
    throw new StripeSignatureError("Stripe-Signature does not match payload.");
  }
}

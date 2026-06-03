import { BadRequestException } from "@nestjs/common";

/**
 * Normalize a user-entered phone number to E.164.
 *
 * Smoke-shop owners and their employees overwhelmingly type US numbers the
 * way they say them — "5551234567", "(555) 123-4567", "1 555 123 4567" — with
 * no "+" and no country code. The old normalizer rejected all of those and
 * demanded "+15551234567", which is the main reason invited employees couldn't
 * sign in. We now accept bare US/NANP numbers and fill in the +1 ourselves.
 *
 *   "+15551234567"             -> "+15551234567"  (already E.164, untouched)
 *   "5551234567"   (10 digits) -> "+15551234567"  (assume US, prepend +1)
 *   "15551234567"  (11, lead 1)-> "+15551234567"  (US typed with leading 1)
 *   "(555) 123-4567"           -> "+15551234567"  (punctuation stripped)
 *   "+447911123456"            -> "+447911123456" (explicit country code kept)
 *
 * Anything without a leading "+" that isn't a recognizable US number is still
 * coerced to "+<digits>" and then validated against E.164 — so an int'l number
 * pasted without its "+" survives, while genuine garbage is rejected.
 */
export function normalizePhone(input: string): string {
  const trimmed = (input || "").trim();
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");

  let e164: string;
  if (hasPlus) {
    e164 = `+${digits}`;
  } else if (digits.length === 10) {
    // Bare US/NANP number — prepend the +1 the user omitted.
    e164 = `+1${digits}`;
  } else {
    // 11-digit "1XXXXXXXXXX" or an int'l number pasted without its "+".
    e164 = `+${digits}`;
  }

  if (!/^\+[1-9]\d{9,14}$/.test(e164)) {
    throw new BadRequestException(
      "Enter a 10-digit US phone number, or include the country code like +15551234567."
    );
  }
  return e164;
}

/**
 * The distinct digit-strings a phone could have been stored under, so a lookup
 * heals historical rows. Early invites stored the synthetic email from the raw
 * digits the owner typed (e.g. "5403706022"); current code normalizes first
 * (e.g. "15403706022"). Returning both lets sign-in find either.
 */
export function phoneDigitVariants(phone: string): string[] {
  const digits = phone.replace(/\D/g, "");
  const variants = new Set<string>();
  if (digits) variants.add(digits);
  if (digits.length === 11 && digits.startsWith("1")) variants.add(digits.slice(1));
  if (digits.length === 10) variants.add(`1${digits}`);
  return Array.from(variants);
}

/** Deterministic placeholder email used for phone-only Supabase auth users. */
export function syntheticPhoneEmail(phone: string, namespace: "owners" | "invites"): string {
  return `phone_${phone.replace(/\D/g, "")}@${namespace}.dailyclose.local`;
}

/**
 * Every synthetic email a phone number could resolve to — both namespaces and
 * every digit variant. Used to look an account up by phone for OTP sign-in.
 */
export function syntheticPhoneEmailCandidates(phone: string): string[] {
  const emails: string[] = [];
  for (const digits of phoneDigitVariants(phone)) {
    emails.push(`phone_${digits}@owners.dailyclose.local`);
    emails.push(`phone_${digits}@invites.dailyclose.local`);
  }
  return emails;
}

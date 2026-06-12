import { randomInt } from "crypto";

// Alphabet for partner referral codes. Deliberately excludes characters that
// are easy to misread when someone reads a code off a printed QR flyer or types
// it from a phone screen: no O/0, no I/1, and no lowercase. 32 symbols.
export const REF_CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
export const REF_CODE_LENGTH = 7;

/**
 * Generate one random, non-sequential referral code (e.g. "K7Q2WMF"). Uses
 * crypto.randomInt for unbiased selection over the alphabet. Uniqueness against
 * existing codes is the caller's job — see PartnersService.create, which retries
 * on the rare collision.
 */
export function generateRefCode(length: number = REF_CODE_LENGTH): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += REF_CODE_ALPHABET[randomInt(REF_CODE_ALPHABET.length)];
  }
  return out;
}

/** True when every character is in the unambiguous alphabet. */
export function isValidRefCode(code: string): boolean {
  if (!code) return false;
  for (const ch of code) {
    if (!REF_CODE_ALPHABET.includes(ch)) return false;
  }
  return true;
}

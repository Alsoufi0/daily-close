import { BadRequestException } from "@nestjs/common";
import {
  normalizePhone,
  phoneDigitVariants,
  syntheticPhoneEmail,
  syntheticPhoneEmailCandidates
} from "./phone";

describe("normalizePhone", () => {
  it("accepts a bare 10-digit US number and prepends +1", () => {
    expect(normalizePhone("5403706022")).toBe("+15403706022");
  });

  it("strips punctuation from a formatted US number", () => {
    expect(normalizePhone("(540) 370-6022")).toBe("+15403706022");
  });

  it("accepts an 11-digit US number typed with a leading 1 but no plus", () => {
    expect(normalizePhone("15403706022")).toBe("+15403706022");
  });

  it("leaves an already-E.164 number untouched", () => {
    expect(normalizePhone("+15403706022")).toBe("+15403706022");
  });

  it("keeps an explicit international country code", () => {
    expect(normalizePhone("+447911123456")).toBe("+447911123456");
  });

  it("rejects an obviously-too-short number", () => {
    expect(() => normalizePhone("12345")).toThrow(BadRequestException);
  });

  it("rejects empty input", () => {
    expect(() => normalizePhone("")).toThrow(BadRequestException);
  });
});

describe("phoneDigitVariants", () => {
  it("returns both the 1-prefixed and bare 10-digit forms", () => {
    expect(phoneDigitVariants("+15403706022").sort()).toEqual(
      ["15403706022", "5403706022"].sort()
    );
  });
});

describe("syntheticPhoneEmailCandidates", () => {
  it("covers both namespaces and both digit variants", () => {
    const got = syntheticPhoneEmailCandidates("+15403706022");
    expect(got).toContain(syntheticPhoneEmail("+15403706022", "invites"));
    expect(got).toContain("phone_5403706022@invites.dailyclose.local");
    expect(got).toContain("phone_15403706022@owners.dailyclose.local");
  });
});

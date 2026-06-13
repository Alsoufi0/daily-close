import { generateRefCode, isValidRefCode, REF_CODE_ALPHABET, REF_CODE_LENGTH } from "./ref-code";

describe("ref-code", () => {
  it("generates codes of the configured length", () => {
    for (let i = 0; i < 50; i++) {
      expect(generateRefCode()).toHaveLength(REF_CODE_LENGTH);
    }
    expect(generateRefCode(10)).toHaveLength(10);
  });

  it("never contains ambiguous characters (O, 0, I, 1)", () => {
    const banned = ["O", "0", "I", "1"];
    for (let i = 0; i < 2000; i++) {
      const code = generateRefCode();
      for (const ch of code) {
        expect(banned).not.toContain(ch);
        expect(REF_CODE_ALPHABET).toContain(ch);
      }
    }
  });

  it("is overwhelmingly likely to be unique across many draws", () => {
    const seen = new Set<string>();
    let collisions = 0;
    for (let i = 0; i < 5000; i++) {
      const code = generateRefCode();
      if (seen.has(code)) collisions++;
      seen.add(code);
    }
    // 32^7 ≈ 3.4e10 space — 5000 draws should essentially never collide.
    expect(collisions).toBe(0);
  });

  it("validates codes against the alphabet", () => {
    expect(isValidRefCode(generateRefCode())).toBe(true);
    expect(isValidRefCode("ABC2345")).toBe(true);
    expect(isValidRefCode("ABC0345")).toBe(false); // contains 0
    expect(isValidRefCode("hello12")).toBe(false); // lowercase + 1
    expect(isValidRefCode("")).toBe(false);
  });
});

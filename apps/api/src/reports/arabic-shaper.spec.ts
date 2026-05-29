import { shapeArabicRtl } from "./arabic-shaper";

const cps = (s: string) => Array.from(s, (c) => c.codePointAt(0)!);

describe("shapeArabicRtl", () => {
  it("passes non-Arabic text through unchanged", () => {
    expect(shapeArabicRtl("2026-05-29")).toBe("2026-05-29");
    expect(shapeArabicRtl("Net Profit $1,234")).toBe("Net Profit $1,234");
  });

  it("shapes a 3-letter word into initial/medial/final and reverses for RTL", () => {
    // beh + lam + meem -> initial(FE91), medial(FEE0), final(FEE2); reversed.
    expect(cps(shapeArabicRtl("بلم"))).toEqual([0xfee2, 0xfee0, 0xfe91]);
  });

  it("uses isolated form for a single letter", () => {
    // beh alone -> isolated FE8F
    expect(cps(shapeArabicRtl("ب"))).toEqual([0xfe8f]);
  });

  it("does not join after a right-joining letter", () => {
    // alef (R) + beh: alef can't join forward, so beh is isolated.
    // alef isolated FE8D, beh isolated FE8F; reversed.
    expect(cps(shapeArabicRtl("اب"))).toEqual([0xfe8f, 0xfe8d]);
  });

  it("folds lam+alef into the ligature glyph", () => {
    // lam + alef -> isolated ligature FEFB
    expect(cps(shapeArabicRtl("لا"))).toEqual([0xfefb]);
    // beh + lam + alef -> beh initial (FE91) then final lam-alef ligature (FEFC); reversed
    expect(cps(shapeArabicRtl("بلا"))).toEqual([0xfefc, 0xfe91]);
  });
});

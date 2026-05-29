/**
 * Minimal Arabic presentation-form shaper for pdf-lib.
 *
 * pdf-lib's `drawText` draws glyphs strictly left-to-right with no contextual
 * shaping and no BiDi. Drawing raw Arabic that way produces disconnected,
 * left-aligned letters — the "not visually appealing" report the user filed.
 *
 * This maps each Arabic base letter to its contextual Presentation-Forms-B
 * glyph (isolated / initial / medial / final) based on its neighbours, folds
 * lam+alef into the ligature glyphs, then reverses the run so the LTR drawer
 * renders it right-to-left. The bundled NotoSansArabic font includes every
 * Forms-B glyph used here (verified), so these codepoints render as real
 * connected letters.
 *
 * Scope: intended for the *pure-Arabic label strings* the report draws (titles,
 * headers, status words). It is NOT a full BiDi engine — strings that mix
 * Arabic with Latin/numbers should be split so numbers are drawn separately.
 * A string containing no Arabic letters is returned unchanged.
 */

// base codepoint -> [isolated, final, initial, medial]
// For right-joining letters (no initial/medial), initial=isolated and
// medial=final so the form lookup degrades correctly.
const FORMS: Record<number, [number, number, number, number]> = {
  0x0621: [0xfe80, 0xfe80, 0xfe80, 0xfe80], // hamza (non-joining)
  0x0622: [0xfe81, 0xfe82, 0xfe81, 0xfe82], // alef madda (R)
  0x0623: [0xfe83, 0xfe84, 0xfe83, 0xfe84], // alef hamza above (R)
  0x0624: [0xfe85, 0xfe86, 0xfe85, 0xfe86], // waw hamza (R)
  0x0625: [0xfe87, 0xfe88, 0xfe87, 0xfe88], // alef hamza below (R)
  0x0626: [0xfe89, 0xfe8a, 0xfe8b, 0xfe8c], // yeh hamza (D)
  0x0627: [0xfe8d, 0xfe8e, 0xfe8d, 0xfe8e], // alef (R)
  0x0628: [0xfe8f, 0xfe90, 0xfe91, 0xfe92], // beh (D)
  0x0629: [0xfe93, 0xfe94, 0xfe93, 0xfe94], // teh marbuta (R)
  0x062a: [0xfe95, 0xfe96, 0xfe97, 0xfe98], // teh (D)
  0x062b: [0xfe99, 0xfe9a, 0xfe9b, 0xfe9c], // theh (D)
  0x062c: [0xfe9d, 0xfe9e, 0xfe9f, 0xfea0], // jeem (D)
  0x062d: [0xfea1, 0xfea2, 0xfea3, 0xfea4], // hah (D)
  0x062e: [0xfea5, 0xfea6, 0xfea7, 0xfea8], // khah (D)
  0x062f: [0xfea9, 0xfeaa, 0xfea9, 0xfeaa], // dal (R)
  0x0630: [0xfeab, 0xfeac, 0xfeab, 0xfeac], // thal (R)
  0x0631: [0xfead, 0xfeae, 0xfead, 0xfeae], // reh (R)
  0x0632: [0xfeaf, 0xfeb0, 0xfeaf, 0xfeb0], // zain (R)
  0x0633: [0xfeb1, 0xfeb2, 0xfeb3, 0xfeb4], // seen (D)
  0x0634: [0xfeb5, 0xfeb6, 0xfeb7, 0xfeb8], // sheen (D)
  0x0635: [0xfeb9, 0xfeba, 0xfebb, 0xfebc], // sad (D)
  0x0636: [0xfebd, 0xfebe, 0xfebf, 0xfec0], // dad (D)
  0x0637: [0xfec1, 0xfec2, 0xfec3, 0xfec4], // tah (D)
  0x0638: [0xfec5, 0xfec6, 0xfec7, 0xfec8], // zah (D)
  0x0639: [0xfec9, 0xfeca, 0xfecb, 0xfecc], // ain (D)
  0x063a: [0xfecd, 0xfece, 0xfecf, 0xfed0], // ghain (D)
  0x0641: [0xfed1, 0xfed2, 0xfed3, 0xfed4], // feh (D)
  0x0642: [0xfed5, 0xfed6, 0xfed7, 0xfed8], // qaf (D)
  0x0643: [0xfed9, 0xfeda, 0xfedb, 0xfedc], // kaf (D)
  0x0644: [0xfedd, 0xfede, 0xfedf, 0xfee0], // lam (D)
  0x0645: [0xfee1, 0xfee2, 0xfee3, 0xfee4], // meem (D)
  0x0646: [0xfee5, 0xfee6, 0xfee7, 0xfee8], // noon (D)
  0x0647: [0xfee9, 0xfeea, 0xfeeb, 0xfeec], // heh (D)
  0x0648: [0xfeed, 0xfeee, 0xfeed, 0xfeee], // waw (R)
  0x0649: [0xfeef, 0xfef0, 0xfeef, 0xfef0], // alef maksura (R)
  0x064a: [0xfef1, 0xfef2, 0xfef3, 0xfef4] // yeh (D)
};

// Dual-joining letters can connect to the NEXT letter. (Everything else is
// right-joining or non-joining and never initiates a forward connection.)
const DUAL = new Set<number>([
  0x0626, 0x0628, 0x062a, 0x062b, 0x062c, 0x062d, 0x062e, 0x0633, 0x0634, 0x0635, 0x0636,
  0x0637, 0x0638, 0x0639, 0x063a, 0x0641, 0x0642, 0x0643, 0x0644, 0x0645, 0x0646, 0x0647, 0x064a
]);

// lam + alef-variant ligatures: alef base -> [isolated, final]
const LAM_ALEF: Record<number, [number, number]> = {
  0x0627: [0xfefb, 0xfefc],
  0x0622: [0xfef5, 0xfef6],
  0x0623: [0xfef7, 0xfef8],
  0x0625: [0xfef9, 0xfefa]
};

const ISO = 0;
const FIN = 1;
const INI = 2;
const MED = 3;

function hasArabic(text: string): boolean {
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    if (cp >= 0x0600 && cp <= 0x06ff) return true;
  }
  return false;
}

/**
 * Reshape an Arabic string into connected presentation forms and reverse it
 * for an LTR drawer (so it reads right-to-left). Non-Arabic strings pass
 * through untouched.
 */
export function shapeArabicRtl(text: string): string {
  if (!hasArabic(text)) return text;
  const cps = Array.from(text, (c) => c.codePointAt(0)!);
  const out: number[] = [];
  let prevConnects = false; // did the previous letter join forward to this one?

  for (let i = 0; i < cps.length; i++) {
    const cp = cps[i];
    const forms = FORMS[cp];

    if (!forms) {
      // space, punctuation, digit, etc. — breaks the join, passes through.
      out.push(cp);
      prevConnects = false;
      continue;
    }

    // lam + alef ligature
    const next = cps[i + 1];
    if (cp === 0x0644 && next !== undefined && LAM_ALEF[next]) {
      const [iso, fin] = LAM_ALEF[next];
      out.push(prevConnects ? fin : iso);
      prevConnects = false; // alef is right-joining: no forward connection
      i++; // consume the alef
      continue;
    }

    const isDual = DUAL.has(cp);
    const nextIsLetter = next !== undefined && !!FORMS[next];
    const joinPrev = prevConnects;
    const joinNext = isDual && nextIsLetter;
    const form = joinPrev && joinNext ? MED : joinNext ? INI : joinPrev ? FIN : ISO;
    out.push(forms[form]);
    prevConnects = joinNext;
  }

  return String.fromCodePoint(...out.reverse());
}

// regenerator-runtime must be imported BEFORE @pdf-lib/fontkit so its
// Indic-script shaping engine (used by NotoSansDevanagari for Hindi) finds
// the `regeneratorRuntime` global it expects. Without this, drawText() on
// Devanagari crashes with "ReferenceError: regeneratorRuntime is not
// defined" — the same crash that previously hid behind the "?" sanitiser.
// The Arabic shaper doesn't need this, but importing once at module-load
// time is harmless.
import "regenerator-runtime/runtime";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { PDFDocument, PDFFont } from "pdf-lib";

/**
 * Locale-aware font loader for PDF report rendering.
 *
 * The pre-fix implementation embedded Helvetica (a pdf-lib standard font)
 * and ran every string through a `pdfText()` sanitizer that replaced any
 * non-Latin character with "?". That turned Arabic/Hindi reports into pages
 * of "????? ????? ???" — the bug the user reported.
 *
 * This module bundles three Noto Sans variants (Latin, Arabic, Devanagari)
 * as TTF files under apps/api/assets/fonts/ and registers them via
 * @pdf-lib/fontkit. The buildPdf path then picks the right pair based on
 * the report's language and embeds them as the document's regular + bold
 * faces.
 *
 * Why bundle (vs. fetch at runtime):
 *   - No network dep on PDF generation (cron emails would block otherwise)
 *   - Deterministic — same font ships with every deploy
 *   - SIL Open Font License: bundling is explicitly permitted
 *   - Total weight: ~2.7 MB — acceptable in a Docker image
 *
 * Font choice rationale (Noto Sans family):
 *   - Designed by Google specifically to render every Unicode script
 *   - Widely tested, well-hinted, identical metrics across scripts so
 *     mixed-locale tables don't jitter line-height
 */

export type SupportedLang = "en" | "ar" | "es" | "hi" | string;

interface LoadedFonts {
  regular: PDFFont;
  bold: PDFFont;
}

/**
 * Font location resolution — try a couple of well-known layouts:
 *   - Local dev / test: cwd is apps/api/, fonts under apps/api/assets/fonts/
 *   - Docker prod: cwd is /app/, fonts under /app/assets/fonts/ (the
 *     Dockerfile COPYs apps/api/assets → /app/assets)
 *   - Explicit override via FONTS_DIR env var (escape hatch for unusual
 *     deploy layouts)
 */
const FONTS_DIR = process.env.FONTS_DIR || join(process.cwd(), "assets", "fonts");

// Resolve paths once at module load. Buffer reads are cached so repeated
// PDF exports don't re-hit the filesystem.
const cache = new Map<string, Promise<Buffer>>();

function readFontFile(filename: string): Promise<Buffer> {
  let p = cache.get(filename);
  if (!p) {
    p = readFile(join(FONTS_DIR, filename));
    cache.set(filename, p);
  }
  return p;
}

/**
 * Pick the TTF pair (regular + bold) for the report's locale, embed both,
 * return them ready for `page.drawText({ font, ... })`. Callers MUST have
 * called `pdf.registerFontkit(fontkit)` on the PDFDocument before invoking
 * this — pdf-lib refuses to embed TTF data otherwise.
 *
 * Falls back to Latin Noto Sans for any unknown locale. The Latin font also
 * covers accented characters (Spanish), Cyrillic, Greek, and Vietnamese, so
 * adding new Latin-script locales later requires zero changes here.
 */
export async function loadFontsForLang(pdf: PDFDocument, lang: SupportedLang): Promise<LoadedFonts> {
  const pair = pickFontPair(lang);
  const [regularBuf, boldBuf] = await Promise.all([
    readFontFile(pair.regular),
    readFontFile(pair.bold)
  ]);
  const [regular, bold] = await Promise.all([
    pdf.embedFont(regularBuf, { subset: true }),
    pdf.embedFont(boldBuf, { subset: true })
  ]);
  return { regular, bold };
}

function pickFontPair(lang: SupportedLang): { regular: string; bold: string } {
  switch (lang) {
    case "ar":
      return { regular: "NotoSansArabic-Regular.ttf", bold: "NotoSansArabic-Bold.ttf" };
    case "hi":
      return { regular: "NotoSansDevanagari-Regular.ttf", bold: "NotoSansDevanagari-Bold.ttf" };
    case "en":
    case "es":
    default:
      return { regular: "NotoSans-Regular.ttf", bold: "NotoSans-Bold.ttf" };
  }
}

/**
 * RTL hint for layout decisions in the PDF (column alignment, text anchor).
 * Right now buildPdf only consults this for column heading alignment — full
 * BiDi layout would need a real shaping engine, which is overkill for the
 * tables the report renders.
 */
export function isRtl(lang: SupportedLang): boolean {
  return lang === "ar";
}

"use client";

/**
 * Preprocess a receipt photo before upload. Kept deliberately gentle:
 * Google Vision and OCR.space both have their own image-conditioning
 * pipelines that work best on the *original* tones — a previous version
 * applied a grayscale + adaptive threshold and OCR accuracy got noticeably
 * worse on real thermal receipts.
 *
 * What we still do, because it helps both providers:
 *   - Resize the longest edge to at most 2500px (Vision's sweet spot, and
 *     it shrinks cellular uploads ~10x for a typical 12MP phone photo).
 *   - Honour EXIF orientation so portrait-shot receipts upload upright.
 *   - Re-encode as JPEG q=0.92 to strip any HEIC/AVIF wrappers that some
 *     OCR providers reject.
 *
 * Anything else (contrast, binarisation, sharpening) goes here only when
 * we have measured evidence it improves accuracy on real receipts.
 */
export async function preprocessReceipt(file: File): Promise<File> {
  if (typeof window === "undefined") return file;
  if (!file.type.startsWith("image/")) return file; // PDFs etc. pass through
  // Small images (<2MB AND already JPEG) don't need re-encoding.
  if (file.size < 2_000_000 && (file.type === "image/jpeg" || file.type === "image/jpg")) {
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" } as any);
    const maxEdge = 2500;
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);

    const blob: Blob = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b ?? new Blob()), "image/jpeg", 0.92)
    );
    if (blob.size === 0) return file;
    const cleanName = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], cleanName, { type: "image/jpeg" });
  } catch {
    return file;
  }
}

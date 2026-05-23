"use client";

/**
 * Preprocess a receipt photo before upload so OCR works on noisy phone shots.
 * - Cap the longest edge at 2000px (Google Vision works best around this size
 *   and it saves a lot of bandwidth on cellular).
 * - Auto-rotate via EXIF (createImageBitmap honors orientation by default).
 * - Convert to grayscale, push contrast, and apply a soft adaptive threshold
 *   so thermal-printer receipts read like clean black-on-white.
 *
 * Falls back to the original file if anything fails (canvas, decoding, etc.).
 */
export async function preprocessReceipt(file: File): Promise<File> {
  if (typeof window === "undefined") return file;
  if (!file.type.startsWith("image/")) return file; // PDFs etc. pass through

  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" } as any);
    const maxEdge = 2000;
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);

    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;

    // 1) Grayscale + light contrast bump.
    // 2) Soft adaptive threshold: compute the average brightness, then push
    //    pixels above it toward white and below it toward black. We don't
    //    hard-binarize because Vision benefits from antialiased edges.
    let sum = 0;
    const gray = new Uint8ClampedArray(d.length / 4);
    for (let i = 0, j = 0; i < d.length; i += 4, j++) {
      const v = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      gray[j] = v;
      sum += v;
    }
    const avg = sum / gray.length;
    // Bias toward whitening (receipts are mostly background).
    const threshold = avg * 1.05;
    const contrastBoost = 1.4;

    for (let i = 0, j = 0; i < d.length; i += 4, j++) {
      let v = gray[j];
      // Push toward white above threshold, toward black below — but smoothly.
      v = (v - threshold) * contrastBoost + threshold;
      // Light gamma on the bright side to clean noisy background paper.
      if (v > threshold) v = Math.min(255, v + (255 - v) * 0.35);
      else v = Math.max(0, v - v * 0.10);
      v = Math.max(0, Math.min(255, v));
      d[i] = v;
      d[i + 1] = v;
      d[i + 2] = v;
    }
    ctx.putImageData(img, 0, 0);

    const blob: Blob = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b ?? new Blob()), "image/jpeg", 0.88)
    );
    if (blob.size === 0) return file;
    const cleanName = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], cleanName, { type: "image/jpeg" });
  } catch {
    return file;
  }
}

export type OcrImageVariant = {
  name: string;
  blob: Blob;
};

const RECEIPT_KEYWORDS = [
  "terminal report",
  "gross sales",
  "cash",
  "credit",
  "debit",
  "tax",
  "refund",
  "discount",
  "sales"
];

export function scoreReceiptText(text: string): number {
  const normalized = text.toLowerCase();
  const keywordScore = RECEIPT_KEYWORDS.reduce(
    (score, keyword) => score + (normalized.includes(keyword) ? 10 : 0),
    0
  );
  const moneyMatches = text.match(/\$?\s*\d{1,3}(?:,\d{3})*(?:\.\d{2})/g) || [];
  const lineScore = Math.min(text.split(/\r?\n/).filter(Boolean).length, 30);

  return keywordScore + Math.min(moneyMatches.length * 4, 60) + lineScore;
}

export async function makeOcrImageVariants(fileUrl: string): Promise<OcrImageVariant[]> {
  const res = await fetch(fileUrl);
  if (!res.ok) {
    throw new Error(`Image fetch failed: ${res.status}`);
  }

  const contentType = res.headers.get("content-type") || "image/jpeg";
  const input = Buffer.from(await res.arrayBuffer());
  const variants: OcrImageVariant[] = [
    { name: "original", blob: bufferToBlob(input, contentType) }
  ];

  if (contentType.includes("pdf")) {
    return variants;
  }

  try {
    const sharpModule = await import("sharp");
    const sharp = sharpModule.default;
    const rotations = [90, 270, 180];

    for (const angle of rotations) {
      const rotated = await sharp(input)
        .rotate(angle)
        .jpeg({ quality: 92, mozjpeg: true })
        .toBuffer();
      variants.push({
        name: `rotated-${angle}`,
        blob: bufferToBlob(rotated, "image/jpeg")
      });
    }
  } catch {
    return variants;
  }

  return variants;
}

function bufferToBlob(buffer: Buffer, contentType: string): Blob {
  return new Blob([new Uint8Array(buffer)], { type: contentType });
}

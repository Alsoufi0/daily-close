import { supabase } from "./supabase";

const BUCKET = "pos-reports";

export interface MobileUpload {
  signedUrl: string;
  path: string;
  fileName: string;
  contentType: string;
}

export async function uploadMobilePosReport(
  storeId: string,
  asset: { uri: string; mimeType?: string | null; fileName?: string | null }
): Promise<MobileUpload> {
  if (!supabase) throw new Error("Supabase not configured for mobile.");

  const res = await fetch(asset.uri);
  const blob = await res.blob();

  const ext = (asset.fileName?.split(".").pop() || asset.mimeType?.split("/")[1] || "jpg")
    .toLowerCase();
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const path = `${storeId}/${new Date().toISOString().slice(0, 10)}/${fileName}`;
  const contentType = asset.mimeType || "image/jpeg";

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType, upsert: false });
  if (upErr) throw new Error(upErr.message);

  const { data, error: urlErr } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 60 * 60 * 24);
  if (urlErr || !data) throw new Error(urlErr?.message || "Could not sign URL.");

  return { signedUrl: data.signedUrl, path, fileName, contentType };
}

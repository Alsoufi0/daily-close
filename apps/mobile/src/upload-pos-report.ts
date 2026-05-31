import * as FileSystem from "expo-file-system";
import { supabase } from "./supabase";

const BUCKET = "pos-reports";

export interface MobileUpload {
  signedUrl: string;
  path: string;
  fileName: string;
  contentType: string;
}

/**
 * Upload a POS report image to Supabase Storage and return a 24h signed URL.
 *
 * Previously used `fetch(asset.uri).then(r => r.blob())` to read the local
 * file, but that's unreliable on Android release builds — the local file://
 * scheme isn't always reachable via fetch in Hermes, surfacing as a generic
 * "Network request failed". Switched to expo-file-system + base64 + manual
 * ArrayBuffer construction, which is the canonical Expo SDK 52 + Supabase
 * pattern. Hermes ships atob/btoa polyfills so no extra dep needed.
 */
export async function uploadMobilePosReport(
  storeId: string,
  asset: { uri: string; mimeType?: string | null; fileName?: string | null }
): Promise<MobileUpload> {
  if (!supabase) throw new Error("Supabase not configured for mobile.");

  // Read local image file into a base64 string via expo-file-system.
  const base64 = await FileSystem.readAsStringAsync(asset.uri, {
    encoding: FileSystem.EncodingType.Base64
  });

  // Decode base64 → Uint8Array. Hermes has global atob/btoa.
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  const ext = (asset.fileName?.split(".").pop() || asset.mimeType?.split("/")[1] || "jpg")
    .toLowerCase();
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const path = `${storeId}/${new Date().toISOString().slice(0, 10)}/${fileName}`;
  const contentType = asset.mimeType || "image/jpeg";

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType, upsert: false });
  if (upErr) throw new Error(upErr.message);

  const { data, error: urlErr } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 60 * 60 * 24);
  if (urlErr || !data) throw new Error(urlErr?.message || "Could not sign URL.");

  return { signedUrl: data.signedUrl, path, fileName, contentType };
}

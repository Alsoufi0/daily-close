"use client";

import { createBrowserSupabase } from "./supabase-browser";

export interface UploadedReport {
  path: string;
  signedUrl: string;
  fileName: string;
  contentType: string;
}

const BUCKET = "pos-reports";

export async function uploadPosReportFile(
  storeId: string,
  file: File
): Promise<UploadedReport> {
  const supabase = createBrowserSupabase();
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const path = `${storeId}/${new Date().toISOString().slice(0, 10)}/${safeName}`;

  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || "image/jpeg",
    upsert: false
  });
  if (upErr) throw new Error(upErr.message);

  // Signed URL good for 24h - the API uses it to fetch the image.
  const { data, error: urlErr } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 60 * 60 * 24);
  if (urlErr || !data) throw new Error(urlErr?.message || "Could not get signed URL.");

  return {
    path,
    signedUrl: data.signedUrl,
    fileName: file.name,
    contentType: file.type || "image/jpeg"
  };
}

import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

@Injectable()
export class SupabaseStorageService {
  private readonly bucket = process.env.SUPABASE_REPORTS_BUCKET || "pos-reports";
  private readonly supabase?: SupabaseClient;

  constructor() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (url && key) {
      this.supabase = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false }
      });
    }
  }

  /**
   * Upload a base64 image and return BOTH the bucket-relative storage path
   * and a 7-day signed URL. Callers must persist `storagePath` so they can
   * mint a fresh signed URL at read time (signed URLs expire; paths don't).
   */
  async uploadBase64(
    path: string,
    base64Data: string,
    contentType: string
  ): Promise<{ storagePath: string; signedUrl: string }> {
    if (!this.supabase) throw new ServiceUnavailableException("Supabase storage is not configured.");

    const cleanBase64 = base64Data.includes(",") ? base64Data.split(",").pop() || "" : base64Data;
    const buffer = Buffer.from(cleanBase64, "base64");
    const { error } = await this.supabase.storage.from(this.bucket).upload(path, buffer, {
      contentType,
      upsert: true
    });

    if (error) throw new ServiceUnavailableException(error.message);

    const { data } = await this.supabase.storage.from(this.bucket).createSignedUrl(path, 60 * 60 * 24 * 7);
    return { storagePath: path, signedUrl: data?.signedUrl || path };
  }

  /**
   * Mint a fresh signed URL for an existing storage object. Used by the
   * Receipts page so old uploads keep rendering even after their original
   * 7-day URL expires. Returns null if storage is not configured or the
   * sign call failed — caller can fall back to the stored URL.
   */
  async signPath(path: string, ttlSeconds = 3600): Promise<string | null> {
    if (!this.supabase) return null;
    try {
      const { data, error } = await this.supabase.storage
        .from(this.bucket)
        .createSignedUrl(path, ttlSeconds);
      if (error) return null;
      return data?.signedUrl || null;
    } catch {
      return null;
    }
  }

  /**
   * Download an object as a Buffer. Used by the receipt-download endpoints
   * for proxied (non-redirect) downloads and zip bundling. Returns null on
   * failure so callers can decide how to report it.
   */
  async download(path: string): Promise<Buffer | null> {
    if (!this.supabase) return null;
    try {
      const { data, error } = await this.supabase.storage.from(this.bucket).download(path);
      if (error || !data) return null;
      const arrayBuffer = await data.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch {
      return null;
    }
  }
}

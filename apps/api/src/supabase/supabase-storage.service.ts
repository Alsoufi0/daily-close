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

  async uploadBase64(path: string, base64Data: string, contentType: string): Promise<string> {
    if (!this.supabase) throw new ServiceUnavailableException("Supabase storage is not configured.");

    const cleanBase64 = base64Data.includes(",") ? base64Data.split(",").pop() || "" : base64Data;
    const buffer = Buffer.from(cleanBase64, "base64");
    const { error } = await this.supabase.storage.from(this.bucket).upload(path, buffer, {
      contentType,
      upsert: true
    });

    if (error) throw new ServiceUnavailableException(error.message);

    const { data } = await this.supabase.storage.from(this.bucket).createSignedUrl(path, 60 * 60 * 24 * 7);
    return data?.signedUrl || path;
  }
}

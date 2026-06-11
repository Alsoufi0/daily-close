import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Sends mobile push notifications through Expo's push service.
 *
 * Device tokens live in a small self-healing `push_tokens` table (created on
 * demand, mirroring how owner_whatsapp_preferences is handled) so this works
 * in prod without a separate migration step. One row per device token; a token
 * re-registering under a new user simply moves to that user (upsert on token).
 */
export interface PushMessage {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private tableReady = false;

  constructor(private readonly prisma: PrismaService) {}

  /** Save (or move) a device's Expo push token for a user. */
  async registerToken(userId: string, token: string, platform?: string) {
    const clean = (token || "").trim();
    if (!this.isExpoToken(clean)) return { saved: false };
    await this.withTable(() =>
      this.prisma.$executeRawUnsafe(
        `insert into public.push_tokens (user_id, token, platform, updated_at)
         values ($1, $2, $3, now())
         on conflict (token) do update set
           user_id = excluded.user_id,
           platform = excluded.platform,
           updated_at = now()`,
        userId,
        clean,
        platform || null
      )
    );
    return { saved: true };
  }

  /** Forget a device token (called on sign-out). */
  async removeToken(token: string) {
    const clean = (token || "").trim();
    if (!clean) return { removed: false };
    await this.withTable(() =>
      this.prisma.$executeRawUnsafe(`delete from public.push_tokens where token = $1`, clean)
    );
    return { removed: true };
  }

  /** Send one message to every device a user has registered. */
  async sendToUser(userId: string, message: PushMessage) {
    return this.sendToUsers([userId], message);
  }

  /** Send one message to every device across a set of users. Best-effort. */
  async sendToUsers(userIds: string[], message: PushMessage) {
    const ids = userIds.filter(Boolean);
    if (ids.length === 0) return { sent: 0 };
    let tokens: string[] = [];
    try {
      tokens = await this.tokensForUsers(ids);
    } catch (err: any) {
      this.logger.warn(`push: token lookup failed: ${err?.message || err}`);
      return { sent: 0 };
    }
    if (tokens.length === 0) return { sent: 0 };
    return this.dispatch(tokens, message);
  }

  private async tokensForUsers(userIds: string[]): Promise<string[]> {
    return this.withTable(async () => {
      const rows = await this.prisma.$queryRawUnsafe<Array<{ token: string }>>(
        `select token from public.push_tokens where user_id = any($1::text[])`,
        userIds
      );
      return rows.map((r) => r.token);
    }, []);
  }

  /** POST to Expo in batches of 100; prune tokens Expo reports as dead. */
  private async dispatch(tokens: string[], message: PushMessage) {
    let sent = 0;
    for (let i = 0; i < tokens.length; i += 100) {
      const batch = tokens.slice(i, i + 100);
      const payload = batch.map((to) => ({
        to,
        title: message.title,
        body: message.body,
        sound: "default",
        priority: "high",
        ...(message.data ? { data: message.data } : {})
      }));
      try {
        const res = await fetch(EXPO_PUSH_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(payload)
        });
        const json: any = await res.json().catch(() => ({}));
        const tickets: any[] = Array.isArray(json?.data) ? json.data : [];
        for (let j = 0; j < tickets.length; j++) {
          const ticket = tickets[j];
          if (ticket?.status === "ok") {
            sent++;
          } else if (ticket?.details?.error === "DeviceNotRegistered") {
            // The app was uninstalled / token rotated. Drop it so we stop trying.
            await this.removeToken(batch[j]).catch(() => undefined);
          }
        }
      } catch (err: any) {
        this.logger.warn(`push: Expo send failed: ${err?.message || err}`);
      }
    }
    return { sent };
  }

  private isExpoToken(token: string): boolean {
    return /^ExponentPushToken\[.+\]$/.test(token) || /^ExpoPushToken\[.+\]$/.test(token);
  }

  /** Run a DB op, creating the table once if it's missing, then retrying. */
  private async withTable<T>(op: () => Promise<T>, fallback?: T): Promise<T> {
    try {
      if (!this.tableReady) await this.ensureTable();
      return await op();
    } catch (err) {
      if (this.isMissingTableError(err)) {
        try {
          await this.ensureTable(true);
          return await op();
        } catch (err2) {
          this.logger.warn(`push: table self-heal failed: ${(err2 as any)?.message || err2}`);
        }
      }
      if (fallback !== undefined) return fallback;
      throw err;
    }
  }

  private async ensureTable(force = false) {
    if (this.tableReady && !force) return;
    await this.prisma.$executeRawUnsafe(
      `create table if not exists public.push_tokens (
        token text primary key,
        user_id text not null references public.users(id) on delete cascade,
        platform text,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )`
    );
    await this.prisma.$executeRawUnsafe(
      `create index if not exists push_tokens_user_idx on public.push_tokens (user_id)`
    );
    this.tableReady = true;
  }

  private isMissingTableError(err: unknown): boolean {
    const code = (err as { code?: string })?.code;
    const message = (err as { message?: string })?.message || "";
    return code === "42P01" || /push_tokens|relation .* does not exist/i.test(message);
  }
}

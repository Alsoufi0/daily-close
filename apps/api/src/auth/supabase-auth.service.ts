import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { createHash, randomBytes, randomInt } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { RequestUser } from "./request-user";

interface CachedUser {
  user: RequestUser;
  expiresAt: number;
}

@Injectable()
export class SupabaseAuthService {
  private readonly supabase?: SupabaseClient;
  // 30-second in-memory cache keyed by token to avoid hitting Supabase
  // + Prisma on every request during a dashboard auto-refresh burst.
  private readonly cache = new Map<string, CachedUser>();
  private static readonly CACHE_TTL_MS = 30_000;
  private static readonly CACHE_MAX = 500;

  constructor(private readonly prisma: PrismaService) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (url && key) {
      this.supabase = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false }
      });
    }
  }

  async getUserFromToken(token: string): Promise<RequestUser> {
    if (!this.supabase) throw new UnauthorizedException("Supabase is not configured.");

    const cached = this.cache.get(token);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.user;
    }

    const { data, error } = await this.supabase.auth.getUser(token);
    if (error || !data.user) throw new UnauthorizedException("Invalid session.");

    const identityEmails = this.emailsForAuthUser(data.user);
    if (identityEmails.length === 0) throw new UnauthorizedException("Invalid session.");

    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ authUserId: data.user.id }, ...identityEmails.map((email) => ({ email }))]
      },
      include: {
        owner: true,
        // Post migration 006: a user can have MANY assignment rows. We need
        // EMPLOYEE rows (the close flow) AND MANAGER rows (per-store admin) —
        // OWNER rows are auto-created for the owner's own stores and don't
        // represent delegated access, so they're excluded.
        employees: {
          where: { deletedAt: null, role: { in: ["EMPLOYEE", "MANAGER"] } },
          include: { store: true }
        }
      }
    });

    if (!user) throw new UnauthorizedException("User profile is not set up.");

    if (!user.authUserId) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { authUserId: data.user.id }
      });
    }

    // Split assignments: EMPLOYEE rows drive the close flow; MANAGER rows grant
    // per-store admin. For back-compat the legacy single-store fields expose the
    // first EMPLOYEE assignment (falling back to a manager row for pure managers
    // who have no plain-employee assignment).
    const employeeAssignments = user.employees.filter((a) => a.role === "EMPLOYEE");
    const managerAssignments = user.employees.filter((a) => a.role === "MANAGER");
    const primaryAssignment = employeeAssignments[0] ?? managerAssignments[0];
    const managedStoreIds = managerAssignments.map((a) => a.storeId);

    const requestUser: RequestUser = {
      id: user.id,
      authUserId: data.user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      // Managers belong to the owner whose stores they manage; derive ownerId
      // from any assignment's store so admin-scope queries can filter by it.
      ownerId: user.owner?.id || primaryAssignment?.store?.ownerId,
      employeeId: primaryAssignment?.id,
      storeId: primaryAssignment?.storeId,
      managedStoreIds: managedStoreIds.length > 0 ? managedStoreIds : undefined
    };

    // Cache and trim
    if (this.cache.size > SupabaseAuthService.CACHE_MAX) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
    this.cache.set(token, {
      user: requestUser,
      expiresAt: Date.now() + SupabaseAuthService.CACHE_TTL_MS
    });

    return requestUser;
  }

  // Idempotently provision a public.users + owners row for a Supabase Auth user.
  // Used the first time a brand-new owner signs up.
  async bootstrapOwnerFromToken(token: string, fallbackName?: string): Promise<RequestUser> {
    if (!this.supabase) throw new UnauthorizedException("Supabase is not configured.");
    const { data, error } = await this.supabase.auth.getUser(token);
    if (error || !data.user) throw new UnauthorizedException("Invalid session.");

    const authId = data.user.id;
    const email = this.primaryEmailForAuthUser(data.user);
    if (!email) throw new UnauthorizedException("Invalid session.");
    const name =
      fallbackName ||
      (data.user.user_metadata as any)?.name ||
      email.split("@")[0];

    let user = await this.prisma.user.findFirst({
      where: { OR: [{ authUserId: authId }, { email }] },
      include: { owner: true, employees: { where: { deletedAt: null, role: "EMPLOYEE" }, include: { store: true } } }
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          name,
          email,
          password: "",
          role: "STORE_OWNER",
          authUserId: authId,
          owner: {
            create: {
              subscriptionPlan: "Standard",
              subscriptionStatus: "TRIALING",
              trialEndsAt: new Date(Date.now() + 14 * 86_400_000)
            }
          }
        },
        include: { owner: true, employees: { where: { deletedAt: null, role: "EMPLOYEE" }, include: { store: true } } }
      });
    } else if (!user.authUserId) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { authUserId: authId },
        include: { owner: true, employees: { where: { deletedAt: null, role: "EMPLOYEE" }, include: { store: true } } }
      });
    }

    if (user.role === "STORE_OWNER" && !user.owner) {
      await this.prisma.owner.create({
        data: {
          userId: user.id,
          subscriptionPlan: "Standard",
          subscriptionStatus: "TRIALING",
          trialEndsAt: new Date(Date.now() + 14 * 86_400_000)
        }
      });
      user = (await this.prisma.user.findUnique({
        where: { id: user.id },
        include: { owner: true, employees: { where: { deletedAt: null, role: "EMPLOYEE" }, include: { store: true } } }
      })) as any;
    }

    const primary = user!.employees?.[0];
    return {
      id: user!.id,
      authUserId: authId,
      name: user!.name,
      email: user!.email,
      role: user!.role,
      ownerId: user!.owner?.id || primary?.store?.ownerId,
      employeeId: primary?.id,
      storeId: primary?.storeId
    };
  }

  /**
   * Admin-only path: create a Supabase Auth user with email already confirmed,
   * provision the matching public.users + owners row, and return the temporary
   * password the caller should hand to the new owner so they can sign in.
   * Used as the bypass while SMTP isn't yet wired up.
   */
  async adminCreateOwner(input: {
    email: string;
    name?: string;
    password?: string;
  }): Promise<{ email: string; name: string; tempPassword: string; ownerId: string }> {
    if (!this.supabase) throw new UnauthorizedException("Supabase is not configured.");

    const email = input.email.trim().toLowerCase();
    if (!email.includes("@")) throw new UnauthorizedException("Invalid email.");
    const tempPassword =
      input.password && input.password.length >= 8
        ? input.password
        : `Dc-${Math.random().toString(36).slice(2, 10)}-${Math.random().toString(36).slice(2, 6)}`;

    // Create auth user (idempotent via email lookup first to avoid 422 collisions).
    const { data: existingByEmail } = await this.supabase.auth.admin.listUsers({ perPage: 1, page: 1 });
    const existing = existingByEmail?.users?.find((u) => u.email?.toLowerCase() === email);
    let authId: string;
    if (existing) {
      authId = existing.id;
      // Make sure email is confirmed + reset the password to the temp one so the caller can hand it over.
      await this.supabase.auth.admin.updateUserById(authId, {
        password: tempPassword,
        email_confirm: true,
        user_metadata: input.name ? { name: input.name } : undefined
      });
    } else {
      const { data, error } = await this.supabase.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: input.name ? { name: input.name } : undefined
      });
      if (error || !data.user) throw new UnauthorizedException(error?.message || "Could not create user.");
      authId = data.user.id;
    }

    const name = input.name || email.split("@")[0];

    // Provision public.users + owners.
    let user = await this.prisma.user.findFirst({
      where: { OR: [{ authUserId: authId }, { email }] },
      include: { owner: true }
    });
    if (!user) {
      user = await this.prisma.user.create({
        data: {
          name,
          email,
          password: "",
          role: "STORE_OWNER",
          authUserId: authId,
          owner: {
            create: {
              subscriptionPlan: "Standard",
              subscriptionStatus: "TRIALING",
              trialEndsAt: new Date(Date.now() + 14 * 86_400_000)
            }
          }
        },
        include: { owner: true }
      });
    } else if (!user.authUserId) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { authUserId: authId },
        include: { owner: true }
      });
    }
    if (!user.owner) {
      await this.prisma.owner.create({
        data: {
          userId: user.id,
          subscriptionPlan: "Standard",
          subscriptionStatus: "TRIALING",
          trialEndsAt: new Date(Date.now() + 14 * 86_400_000)
        }
      });
      user = (await this.prisma.user.findUnique({
        where: { id: user.id },
        include: { owner: true }
      })) as any;
    }

    return { email, name, tempPassword, ownerId: user!.owner!.id };
  }

  async signupOwner(input: {
    email?: string;
    phone?: string;
    name: string;
    password: string;
  }): Promise<{ email: string; phone: string | null; name: string; ownerId: string }> {
    if (!this.supabase) throw new UnauthorizedException("Supabase is not configured.");

    const phone = input.phone ? this.normalizePhone(input.phone) : undefined;
    const email = input.email?.trim().toLowerCase() || (phone ? this.syntheticPhoneEmail(phone, "owners") : "");
    const name = input.name.trim();
    if (!email && !phone) throw new BadRequestException("Enter an email or phone number.");
    if (input.email && !email.includes("@")) throw new BadRequestException("Enter a valid email.");
    if (!name) throw new BadRequestException("Name is required.");
    if (input.password.length < 8) throw new BadRequestException("Password must be at least 8 characters.");

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException(
        phone ? "An account with this phone already exists. Please sign in." : "An account with this email already exists. Please sign in."
      );
    }

    const createInput = phone
      ? {
          email,
          password: input.password,
          email_confirm: true,
          user_metadata: { name, phone, role: "STORE_OWNER", signup_channel: "phone" }
        }
      : {
          email,
          password: input.password,
          email_confirm: true,
          user_metadata: { name, role: "STORE_OWNER", signup_channel: "email" }
        };
    const { data, error } = await this.supabase.auth.admin.createUser(createInput);
    if (error || !data.user) {
      throw new BadRequestException(error?.message || "Could not create account.");
    }

    const user = await this.prisma.user.create({
      data: {
        name,
        email,
        password: "",
        role: "STORE_OWNER",
        authUserId: data.user.id,
        owner: {
          create: {
            subscriptionPlan: "Standard",
            subscriptionStatus: "TRIALING",
            trialEndsAt: new Date(Date.now() + 14 * 86_400_000)
          }
        }
      },
      include: { owner: true }
    });

    return { email, phone: phone ?? null, name, ownerId: user.owner!.id };
  }

  async requestPhonePasswordReset(input: { phone?: string }): Promise<{ sent: boolean; message: string }> {
    if (!this.supabase) throw new UnauthorizedException("Supabase is not configured.");
    const phone = this.normalizePhone(input.phone || "");
    const user = await this.findUserByPhone(phone);
    if (!user?.authUserId) {
      // Same outward response as success to avoid phone-number enumeration.
      return { sent: true, message: "If that number exists, a reset code was sent." };
    }

    if (this.isTwilioVerifyConfigured()) {
      const sent = await this.startTwilioVerify(phone);
      return {
        sent,
        message: sent
          ? "Reset code sent."
          : "Reset code could not be sent. Check Twilio WhatsApp setup."
      };
    }

    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    await this.ensurePhoneResetTable();
    await this.prisma.$executeRawUnsafe(
      `insert into public.phone_password_reset_codes
         (id, phone, user_id, auth_user_id, code_hash, expires_at)
       values ($1, $2, $3, $4, $5, now() + interval '10 minutes')`,
      randomBytes(16).toString("hex"),
      phone,
      user.id,
      user.authUserId,
      this.hashResetCode(phone, code)
    );

    const sent = await this.sendTwilioPhoneMessage(
      phone,
      `Daily Close password reset code: ${code}. This code expires in 10 minutes.`
    );
    return {
      sent,
      message: sent
        ? "Reset code sent."
        : "Reset code could not be sent. Check Twilio WhatsApp setup."
    };
  }

  async confirmPhonePasswordReset(input: {
    phone?: string;
    code?: string;
    password?: string;
  }): Promise<{ reset: true }> {
    if (!this.supabase) throw new UnauthorizedException("Supabase is not configured.");
    const phone = this.normalizePhone(input.phone || "");
    const code = String(input.code || "").replace(/\D/g, "");
    const password = input.password || "";
    if (code.length !== 6) throw new BadRequestException("Enter the 6 digit code.");
    if (password.length < 8) throw new BadRequestException("Password must be at least 8 characters.");

    const user = await this.findUserByPhone(phone);
    if (!user?.authUserId) throw new BadRequestException("Code is invalid or expired.");

    if (this.isTwilioVerifyConfigured()) {
      const verified = await this.checkTwilioVerify(phone, code);
      if (!verified) throw new BadRequestException("Code is invalid or expired.");
      const { error } = await this.supabase.auth.admin.updateUserById(user.authUserId, {
        password
      });
      if (error) throw new BadRequestException(error.message);
      return { reset: true };
    }

    await this.ensurePhoneResetTable();
    const rows = await this.prisma.$queryRawUnsafe<Array<{
      id: string;
      auth_user_id: string;
    }>>(
      `select id, auth_user_id
         from public.phone_password_reset_codes
        where phone = $1
          and code_hash = $2
          and consumed_at is null
          and expires_at > now()
        order by created_at desc
        limit 1`,
      phone,
      this.hashResetCode(phone, code)
    );
    const row = rows[0];
    if (!row) throw new BadRequestException("Code is invalid or expired.");

    const { error } = await this.supabase.auth.admin.updateUserById(row.auth_user_id, {
      password
    });
    if (error) throw new BadRequestException(error.message);

    await this.prisma.$executeRawUnsafe(
      `update public.phone_password_reset_codes
          set consumed_at = now()
        where id = $1`,
      row.id
    );
    return { reset: true };
  }

  async requestPhoneLogin(input: { phone?: string }): Promise<{ sent: boolean; message: string }> {
    if (!this.supabase) throw new UnauthorizedException("Supabase is not configured.");
    const phone = this.normalizePhone(input.phone || "");
    const user = await this.findUserByPhone(phone);
    if (!user?.authUserId) {
      return { sent: true, message: "If that number exists, a sign-in code was sent." };
    }

    if (this.isTwilioVerifyConfigured()) {
      const sent = await this.startTwilioVerify(phone);
      return {
        sent,
        message: sent
          ? "Sign-in code sent."
          : "Sign-in code could not be sent. Check Twilio WhatsApp setup."
      };
    }

    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    await this.ensurePhoneLoginTable();
    await this.prisma.$executeRawUnsafe(
      `insert into public.phone_login_codes
         (id, phone, user_id, auth_user_id, code_hash, expires_at)
       values ($1, $2, $3, $4, $5, now() + interval '10 minutes')`,
      randomBytes(16).toString("hex"),
      phone,
      user.id,
      user.authUserId,
      this.hashResetCode(phone, code)
    );

    const sent = await this.sendTwilioPhoneMessage(
      phone,
      `Daily Close sign-in code: ${code}. This code expires in 10 minutes.`
    );
    return {
      sent,
      message: sent
        ? "Sign-in code sent."
        : "Sign-in code could not be sent. Check Twilio WhatsApp setup."
    };
  }

  async confirmPhoneLogin(input: {
    phone?: string;
    code?: string;
  }): Promise<{ tokenHash: string; type: "magiclink" }> {
    if (!this.supabase) throw new UnauthorizedException("Supabase is not configured.");
    const phone = this.normalizePhone(input.phone || "");
    const code = String(input.code || "").replace(/\D/g, "");
    if (code.length !== 6) throw new BadRequestException("Enter the 6 digit code.");

    const user = await this.findUserByPhone(phone);
    if (!user?.authUserId || !user.email) throw new BadRequestException("Code is invalid or expired.");

    if (this.isTwilioVerifyConfigured()) {
      const verified = await this.checkTwilioVerify(phone, code);
      if (!verified) throw new BadRequestException("Code is invalid or expired.");
    } else {
      await this.ensurePhoneLoginTable();
      const rows = await this.prisma.$queryRawUnsafe<Array<{ id: string }>>(
        `select id
           from public.phone_login_codes
          where phone = $1
            and code_hash = $2
            and consumed_at is null
            and expires_at > now()
          order by created_at desc
          limit 1`,
        phone,
        this.hashResetCode(phone, code)
      );
      const row = rows[0];
      if (!row) throw new BadRequestException("Code is invalid or expired.");
      await this.prisma.$executeRawUnsafe(
        `update public.phone_login_codes
            set consumed_at = now()
          where id = $1`,
        row.id
      );
    }

    const { data, error } = await this.supabase.auth.admin.generateLink({
      type: "magiclink",
      email: user.email
    });
    if (error || !data.properties?.hashed_token) {
      throw new BadRequestException(error?.message || "Could not create sign-in session.");
    }

    return { tokenHash: data.properties.hashed_token, type: "magiclink" };
  }

  private primaryEmailForAuthUser(user: { email?: string | null; phone?: string | null }): string | null {
    return this.emailsForAuthUser(user)[0] || null;
  }

  private emailsForAuthUser(user: { email?: string | null; phone?: string | null }): string[] {
    const emails: string[] = [];
    if (user.email) emails.push(user.email.toLowerCase());
    if (user.phone) {
      const phone = this.normalizePhone(user.phone);
      emails.push(this.syntheticPhoneEmail(phone, "owners"));
      emails.push(this.syntheticPhoneEmail(phone, "invites"));
    }
    return Array.from(new Set(emails));
  }

  private syntheticPhoneEmail(phone: string, namespace: "owners" | "invites"): string {
    return `phone_${phone.replace(/\D/g, "")}@${namespace}.dailyclose.local`;
  }

  private async findUserByPhone(phone: string): Promise<{ id: string; email: string; authUserId: string | null } | null> {
    return this.prisma.user.findFirst({
      where: {
        OR: [
          { email: this.syntheticPhoneEmail(phone, "owners") },
          { email: this.syntheticPhoneEmail(phone, "invites") }
        ]
      },
      select: { id: true, email: true, authUserId: true }
    });
  }

  private async ensurePhoneResetTable() {
    await this.prisma.$executeRawUnsafe(
      `create table if not exists public.phone_password_reset_codes (
        id text primary key,
        phone text not null,
        user_id text not null references public.users(id) on delete cascade,
        auth_user_id text not null,
        code_hash text not null,
        expires_at timestamptz not null,
        consumed_at timestamptz,
        created_at timestamptz not null default now()
      )`
    );
    await this.prisma.$executeRawUnsafe(
      `create index if not exists phone_password_reset_codes_phone_idx
         on public.phone_password_reset_codes (phone, created_at desc)`
    );
  }

  private async ensurePhoneLoginTable() {
    await this.prisma.$executeRawUnsafe(
      `create table if not exists public.phone_login_codes (
        id text primary key,
        phone text not null,
        user_id text not null references public.users(id) on delete cascade,
        auth_user_id text not null,
        code_hash text not null,
        expires_at timestamptz not null,
        consumed_at timestamptz,
        created_at timestamptz not null default now()
      )`
    );
    await this.prisma.$executeRawUnsafe(
      `create index if not exists phone_login_codes_phone_idx
         on public.phone_login_codes (phone, created_at desc)`
    );
  }

  private hashResetCode(phone: string, code: string) {
    const secret = process.env.CRON_SECRET || process.env.TWILIO_AUTH_TOKEN || "daily-close-dev";
    return createHash("sha256").update(`${phone}:${code}:${secret}`).digest("hex");
  }

  private async sendTwilioPhoneMessage(phone: string, body: string): Promise<boolean> {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const whatsapp = String(process.env.TWILIO_DELIVERY_CHANNEL || process.env.TWILIO_CHANNEL || "").toLowerCase() === "whatsapp";
    const explicitWhatsAppFrom = process.env.TWILIO_WHATSAPP_FROM;
    const messagingServiceSid = whatsapp && explicitWhatsAppFrom ? undefined : process.env.TWILIO_MESSAGING_SERVICE_SID;
    const from = whatsapp
      ? explicitWhatsAppFrom || process.env.TWILIO_FROM_NUMBER
      : process.env.TWILIO_FROM_NUMBER;
    if (!sid || !token || (!messagingServiceSid && !from)) return false;

    const params = new URLSearchParams();
    params.set("To", whatsapp ? this.whatsAppAddress(phone) : phone);
    params.set("Body", body);
    if (messagingServiceSid) {
      params.set("MessagingServiceSid", messagingServiceSid);
    } else if (from) {
      params.set("From", whatsapp ? this.whatsAppAddress(from) : from);
    }
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: params.toString()
    });
    return res.ok;
  }

  private isTwilioVerifyConfigured(): boolean {
    return Boolean(
      process.env.TWILIO_ACCOUNT_SID &&
        process.env.TWILIO_AUTH_TOKEN &&
        process.env.TWILIO_VERIFY_SERVICE_SID
    );
  }

  private async startTwilioVerify(phone: string): Promise<boolean> {
    const sid = process.env.TWILIO_ACCOUNT_SID!;
    const token = process.env.TWILIO_AUTH_TOKEN!;
    const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID!;
    const channel = this.twilioVerifyChannel();
    const params = new URLSearchParams();
    params.set("To", phone);
    params.set("Channel", channel);
    const res = await fetch(
      `https://verify.twilio.com/v2/Services/${serviceSid}/Verifications`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: params.toString()
      }
    );
    return res.ok;
  }

  private async checkTwilioVerify(phone: string, code: string): Promise<boolean> {
    const sid = process.env.TWILIO_ACCOUNT_SID!;
    const token = process.env.TWILIO_AUTH_TOKEN!;
    const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID!;
    const params = new URLSearchParams();
    params.set("To", phone);
    params.set("Code", code);
    const res = await fetch(
      `https://verify.twilio.com/v2/Services/${serviceSid}/VerificationCheck`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: params.toString()
      }
    );
    if (!res.ok) return false;
    const data = await res.json().catch(() => null);
    return data?.status === "approved";
  }

  private twilioVerifyChannel(): "sms" | "whatsapp" {
    const channel = String(process.env.TWILIO_DELIVERY_CHANNEL || process.env.TWILIO_CHANNEL || "sms").toLowerCase();
    return channel === "whatsapp" ? "whatsapp" : "sms";
  }

  private whatsAppAddress(phone: string): string {
    if (phone.startsWith("whatsapp:")) return phone;
    const trimmed = phone.trim();
    const e164 = trimmed.startsWith("+") ? trimmed : `+${trimmed.replace(/[^\d]/g, "")}`;
    return `whatsapp:${e164}`;
  }

  private normalizePhone(input: string): string {
    const clean = input.trim().replace(/[^\d+]/g, "");
    if (!/^\+[1-9]\d{7,14}$/.test(clean)) {
      throw new BadRequestException("Enter the phone number with country code, like +15551234567.");
    }
    return clean;
  }

  /**
   * Self-service account deletion (Apple Guideline 5.1.1(v) requires this to
   * be in-app, not "email support"). Cancels any active Stripe subscription,
   * cascades the user's personal data, soft-deletes business records they
   * own, anonymizes the User row (since daily_close.submitted_by_user_id is
   * NOT NULL — can't drop the row outright), and finally deletes the Supabase
   * auth user so sign-in is permanently blocked.
   *
   * All sub-steps are best-effort past the cascade: a Stripe API hiccup or a
   * stale Supabase auth row must not strand a user with an active account
   * they can't delete. The transaction guarantees the local cascade is atomic.
   */
  async deleteAccount(user: RequestUser): Promise<{ deleted: true; canceledStripeSub: boolean }> {
    // Capture authUserId + Stripe subscription BEFORE the anonymizing tx —
    // we need them after, and the tx wipes both.
    const fullUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      include: { owner: true }
    });
    if (!fullUser) throw new UnauthorizedException("Account not found.");
    const authUserId = fullUser.authUserId;
    const stripeSubscriptionId = fullUser.owner?.stripeSubscriptionId ?? null;
    const ownerId = fullUser.owner?.id ?? null;

    // 1. Best-effort: cancel the active Stripe sub so the user isn't billed
    //    again after deletion. Failing here must NOT block local deletion.
    let canceledStripeSub = false;
    if (stripeSubscriptionId && process.env.STRIPE_SECRET_KEY) {
      try {
        const res = await fetch(
          `https://api.stripe.com/v1/subscriptions/${stripeSubscriptionId}`,
          {
            method: "DELETE",
            headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` }
          }
        );
        canceledStripeSub = res.ok;
      } catch {
        canceledStripeSub = false;
      }
    }

    // 2. Local cascade. Personal-identity rows are dropped; business records
    //    are soft-deleted (the FK from daily_close keeps the user row pinned,
    //    so we anonymize it instead of deleting).
    await this.prisma.$transaction(async (tx) => {
      await tx.notification.deleteMany({ where: { userId: user.id } });
      await tx.auditLog.deleteMany({ where: { userId: user.id } });
      await tx.phoneConsent.deleteMany({ where: { consentedByUserId: user.id } });
      // Soft-delete this user's employee assignments so any future invite by
      // the same email/phone gets a clean slate but the daily_close history
      // stays intact for the owning store.
      await tx.employee.updateMany({
        where: { userId: user.id, deletedAt: null },
        data: { deletedAt: new Date() }
      });
      // Owner-side: soft-delete owned stores + their employee assignments.
      // We don't touch the daily_close rows themselves; the dashboard already
      // filters by store.deletedAt and they'd disappear from owner views.
      if (ownerId) {
        await tx.store.updateMany({
          where: { ownerId, deletedAt: null },
          data: { deletedAt: new Date() }
        });
        await tx.employee.updateMany({
          where: { store: { ownerId }, deletedAt: null },
          data: { deletedAt: new Date() }
        });
      }
      // Anonymize the User row — we can't delete it (FK from daily_close).
      // Email becomes a unique sentinel so a re-signup with the original
      // address isn't blocked by the unique constraint.
      await tx.user.update({
        where: { id: user.id },
        data: {
          name: "Deleted user",
          email: `deleted_${user.id}@deleted.dailyclose.local`,
          authUserId: null,
          password: ""
        }
      });
    });

    // 3. Best-effort: remove the Supabase auth user so the email/phone +
    //    password combo can't sign in anymore. Failure here is logged but
    //    not fatal — the User row is already anonymized, so even if the auth
    //    row lingers, the API won't return a profile for it.
    if (this.supabase && authUserId) {
      try {
        await this.supabase.auth.admin.deleteUser(authUserId);
      } catch {
        /* already gone / permission issue — anonymized DB row is the gate */
      }
    }

    // Invalidate any cached token entries for this user.
    for (const [token, cached] of this.cache.entries()) {
      if (cached.user.id === user.id) this.cache.delete(token);
    }

    return { deleted: true, canceledStripeSub };
  }
}

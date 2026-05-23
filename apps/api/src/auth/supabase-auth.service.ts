import { Injectable, UnauthorizedException } from "@nestjs/common";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
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
    if (error || !data.user.email) throw new UnauthorizedException("Invalid session.");

    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ authUserId: data.user.id }, { email: data.user.email }]
      },
      include: {
        owner: true,
        employee: true
      }
    });

    if (!user) throw new UnauthorizedException("User profile is not set up.");

    if (!user.authUserId) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { authUserId: data.user.id }
      });
    }

    const requestUser: RequestUser = {
      id: user.id,
      authUserId: data.user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      ownerId: user.owner?.id,
      employeeId: user.employee?.id,
      storeId: user.employee?.storeId
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
    if (error || !data.user.email) throw new UnauthorizedException("Invalid session.");

    const authId = data.user.id;
    const email = data.user.email;
    const name =
      fallbackName ||
      (data.user.user_metadata as any)?.name ||
      email.split("@")[0];

    let user = await this.prisma.user.findFirst({
      where: { OR: [{ authUserId: authId }, { email }] },
      include: { owner: true, employee: true }
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
        include: { owner: true, employee: true }
      });
    } else if (!user.authUserId) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { authUserId: authId },
        include: { owner: true, employee: true }
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
        include: { owner: true, employee: true }
      })) as any;
    }

    return {
      id: user!.id,
      authUserId: authId,
      name: user!.name,
      email: user!.email,
      role: user!.role,
      ownerId: user!.owner?.id,
      employeeId: user!.employee?.id,
      storeId: user!.employee?.storeId
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

  async getDemoUser(role: "owner" | "employee" = "owner"): Promise<RequestUser> {
    const user = await this.prisma.user.findFirst({
      where: { email: role === "owner" ? "owner@demo.com" : "maya@demo.com" },
      include: { owner: true, employee: true }
    });

    if (!user) throw new UnauthorizedException("Demo user has not been seeded.");

    return {
      id: user.id,
      authUserId: user.authUserId,
      name: user.name,
      email: user.email,
      role: user.role,
      ownerId: user.owner?.id,
      employeeId: user.employee?.id,
      storeId: user.employee?.storeId
    };
  }
}

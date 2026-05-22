import { Injectable, UnauthorizedException } from "@nestjs/common";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { PrismaService } from "../prisma/prisma.service";
import { RequestUser } from "./request-user";

@Injectable()
export class SupabaseAuthService {
  private readonly supabase?: SupabaseClient;

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

    return {
      id: user.id,
      authUserId: data.user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      ownerId: user.owner?.id,
      employeeId: user.employee?.id,
      storeId: user.employee?.storeId
    };
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

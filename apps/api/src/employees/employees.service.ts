import { BadRequestException, ConflictException, ForbiddenException, Injectable } from "@nestjs/common";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { PrismaService } from "../prisma/prisma.service";
import { RequestUser } from "../auth/request-user";
import { InviteEmployeeDto } from "./dto/invite-employee.dto";

@Injectable()
export class EmployeesService {
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

  private assertOwner(user: RequestUser): asserts user is RequestUser & { ownerId: string } {
    if (user.role !== "STORE_OWNER" || !user.ownerId) {
      throw new ForbiddenException("Only owners can manage employees.");
    }
  }

  async listForOwner(user: RequestUser) {
    this.assertOwner(user);
    return this.prisma.employee.findMany({
      where: { store: { ownerId: user.ownerId } },
      include: { user: true, store: true },
      orderBy: { user: { name: "asc" } }
    });
  }

  async invite(user: RequestUser, input: InviteEmployeeDto) {
    this.assertOwner(user);

    // Store must belong to this owner
    const store = await this.prisma.store.findFirst({
      where: { id: input.storeId, ownerId: user.ownerId }
    });
    if (!store) throw new BadRequestException("Store does not belong to you.");

    const existingUser = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (existingUser) throw new ConflictException("A user with this email already exists.");

    let authUserId: string | undefined;
    if (this.supabase) {
      const invite = await this.supabase.auth.admin.inviteUserByEmail(input.email, {
        data: { name: input.name, role: "EMPLOYEE" }
      });
      if (invite.error) throw new BadRequestException(invite.error.message);
      authUserId = invite.data.user?.id;
    }

    const created = await this.prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        password: "", // unused - Supabase handles auth
        role: "EMPLOYEE",
        authUserId,
        employee: {
          create: { storeId: input.storeId }
        }
      },
      include: { employee: true }
    });

    return {
      id: created.id,
      employeeId: created.employee?.id,
      email: created.email,
      name: created.name,
      storeId: input.storeId,
      invitedViaSupabase: Boolean(this.supabase)
    };
  }
}

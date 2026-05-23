import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { randomBytes } from "crypto";
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
      where: { store: { ownerId: user.ownerId }, deletedAt: null },
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

    // Strong temporary password the owner shares with the employee.
    const tempPassword = randomBytes(9).toString("base64url") + "Aa1!";

    let authUserId: string | undefined;
    if (this.supabase) {
      const create = await this.supabase.auth.admin.createUser({
        email: input.email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { name: input.name, role: "EMPLOYEE" }
      });
      if (create.error) throw new BadRequestException(create.error.message);
      authUserId = create.data.user?.id;
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
      tempPassword,
      invitedViaSupabase: Boolean(this.supabase)
    };
  }

  async resetPassword(user: RequestUser, employeeId: string) {
    this.assertOwner(user);

    const emp = await this.prisma.employee.findFirst({
      where: { id: employeeId, store: { ownerId: user.ownerId } },
      include: { user: true }
    });
    if (!emp) throw new NotFoundException("Employee not found.");
    if (!emp.user.authUserId) {
      throw new BadRequestException("Employee has no Supabase auth user yet.");
    }

    // Generate a strong temp password the owner can share with the employee.
    const tempPassword = randomBytes(9).toString("base64url") + "Aa1!";

    if (this.supabase) {
      const { error } = await this.supabase.auth.admin.updateUserById(emp.user.authUserId, {
        password: tempPassword
      });
      if (error) throw new BadRequestException(error.message);
    }

    return {
      employeeId: emp.id,
      email: emp.user.email,
      tempPassword,
      reset: this.supabase ? true : false
    };
  }

  async setAdminAccess(user: RequestUser, employeeId: string, isAdmin: boolean) {
    this.assertOwner(user);

    const emp = await this.prisma.employee.findFirst({
      where: { id: employeeId, store: { ownerId: user.ownerId }, deletedAt: null },
      include: { user: true }
    });
    if (!emp) throw new NotFoundException("Employee not found.");
    if (emp.user.id === user.id) {
      throw new BadRequestException("You cannot change your own admin access.");
    }

    const role = isAdmin ? "STORE_OWNER" : "EMPLOYEE";
    const updated = await this.prisma.user.update({
      where: { id: emp.userId },
      data: { role },
      include: { employee: true }
    });

    if (this.supabase && emp.user.authUserId) {
      try {
        await this.supabase.auth.admin.updateUserById(emp.user.authUserId, {
          user_metadata: { name: emp.user.name, role }
        });
      } catch {
        // The database role is authoritative for API access.
      }
    }

    return {
      employeeId,
      userId: updated.id,
      role: updated.role,
      isAdmin: updated.role === "STORE_OWNER"
    };
  }

  async remove(user: RequestUser, employeeId: string) {
    this.assertOwner(user);

    const emp = await this.prisma.employee.findFirst({
      where: { id: employeeId, store: { ownerId: user.ownerId }, deletedAt: null },
      include: { user: true }
    });
    if (!emp) throw new NotFoundException("Employee not found.");

    // Soft-delete the employee row (preserves daily_close FK history)
    await this.prisma.employee.update({
      where: { id: employeeId },
      data: { deletedAt: new Date() }
    });

    // Block sign-in by deleting the Supabase auth user (if any)
    if (this.supabase && emp.user.authUserId) {
      try {
        await this.supabase.auth.admin.deleteUser(emp.user.authUserId);
      } catch {
        // ignore - already gone or permission issue; soft delete is what matters
      }
    }

    return { employeeId, deleted: true };
  }
}

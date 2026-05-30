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
import { SmsService } from "../notifications/sms.service";
import { InviteEmployeeDto } from "./dto/invite-employee.dto";

@Injectable()
export class EmployeesService {
  private readonly supabase?: SupabaseClient;

  constructor(
    private readonly prisma: PrismaService,
    private readonly sms: SmsService
  ) {
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
    // Only EMPLOYEE-role assignments. OWNER-role rows are auto-created
    // by migration 006 / future store-creation flow so the owner can
    // close their own stores; they're not "employees" from the owner's
    // POV and shouldn't appear in the employees list.
    return this.prisma.employee.findMany({
      where: { store: { ownerId: user.ownerId }, deletedAt: null, role: "EMPLOYEE" },
      include: { user: true, store: true },
      orderBy: { user: { name: "asc" } }
    });
  }

  async invite(user: RequestUser, input: InviteEmployeeDto) {
    this.assertOwner(user);

    const email = input.email?.trim() || undefined;
    const phone = input.phone?.trim() || undefined;
    if (!email && !phone) {
      throw new BadRequestException("Provide an email or phone for the employee.");
    }

    // Store must belong to this owner
    const store = await this.prisma.store.findFirst({
      where: { id: input.storeId, ownerId: user.ownerId }
    });
    if (!store) throw new BadRequestException("Store does not belong to you.");

    // The `users` table requires a unique email today, so a phone-only invite
    // gets a deterministic placeholder derived from the phone. The real phone
    // lives in Supabase auth.users (used for sign-in and future SMS sends).
    // A follow-up migration can add `users.phone` + make email nullable; until
    // then this keeps the feature shipping without a schema change.
    const syntheticEmail = phone
      ? `phone_${phone.replace(/\D/g, "")}@invites.dailyclose.local`
      : undefined;
    const lookupEmail = email ?? syntheticEmail!;

    const existingUser = await this.prisma.user.findUnique({ where: { email: lookupEmail } });
    if (existingUser) {
      throw new ConflictException(
        email
          ? "A user with this email already exists."
          : "A user with this phone already exists."
      );
    }

    // Strong temporary password the owner shares with the employee (over
    // whichever channel they prefer — email, SMS, in person).
    const tempPassword = randomBytes(9).toString("base64url") + "Aa1!";

    let authUserId: string | undefined;
    if (this.supabase) {
      const create = email
        ? await this.supabase.auth.admin.createUser({
            email,
            password: tempPassword,
            email_confirm: true,
            user_metadata: { name: input.name, role: "EMPLOYEE" }
          })
        : await this.supabase.auth.admin.createUser({
            phone: phone!,
            password: tempPassword,
            phone_confirm: true,
            user_metadata: { name: input.name, role: "EMPLOYEE" }
          });
      if (create.error) throw new BadRequestException(create.error.message);
      authUserId = create.data.user?.id;
    }

    const created = await this.prisma.user.create({
      data: {
        name: input.name,
        email: lookupEmail,
        password: "", // unused - Supabase handles auth
        role: "EMPLOYEE",
        authUserId,
        // Post migration 006: `employees` is a list (multi-store
        // assignments). Initial invite creates the first EMPLOYEE-role
        // assignment for the invited store; additional stores are added
        // via assignToStore() below.
        employees: {
          create: { storeId: input.storeId, role: "EMPLOYEE" }
        }
      },
      include: { employees: true }
    });

    // Best-effort welcome SMS for phone invites. We never block the invite on
    // SMS — Twilio could be misconfigured, the carrier could reject, the owner
    // could still hand off the temp password manually. The response includes
    // `smsSent` + an optional `smsError` so the admin UI can either say "Sent
    // via SMS" or fall back to the share-this-password modal.
    let smsSent = false;
    let smsError: string | undefined;
    if (phone) {
      const result = await this.sms.sendEmployeeWelcome({
        phone,
        name: input.name,
        storeName: store.storeName,
        tempPassword
      });
      smsSent = result.sent;
      smsError = result.error;
    }

    return {
      id: created.id,
      employeeId: created.employees[0]?.id,
      email: email ?? null,
      phone: phone ?? null,
      name: created.name,
      storeId: input.storeId,
      tempPassword,
      invitedViaSupabase: Boolean(this.supabase),
      smsSent,
      smsError: smsError ?? null
    };
  }

  /**
   * Assign an EXISTING employee to an additional store the owner owns.
   * Idempotent — if the user is already assigned to this store, returns
   * the existing assignment without erroring.
   *
   * Why this exists: the `invite()` method only creates ONE assignment
   * (for the invited store). When the same employee should also work
   * Store B, the owner uses this endpoint instead of inviting again
   * (which would fail because the user's email already exists).
   */
  async assignToStore(user: RequestUser, employeeId: string, targetStoreId: string) {
    this.assertOwner(user);

    // Verify the source employee belongs to one of the owner's stores
    // (i.e. the owner has the right to "transfer/extend" this employee).
    const source = await this.prisma.employee.findFirst({
      where: { id: employeeId, store: { ownerId: user.ownerId }, deletedAt: null },
      include: { user: true }
    });
    if (!source) throw new NotFoundException("Employee not found.");

    // Target store must also belong to the same owner.
    const targetStore = await this.prisma.store.findFirst({
      where: { id: targetStoreId, ownerId: user.ownerId, deletedAt: null }
    });
    if (!targetStore) throw new BadRequestException("Target store does not belong to you.");

    // Idempotent: if already assigned, return the existing row.
    const existing = await this.prisma.employee.findFirst({
      where: { userId: source.userId, storeId: targetStoreId, deletedAt: null }
    });
    if (existing) {
      return {
        employeeId: existing.id,
        userId: source.userId,
        storeId: targetStoreId,
        alreadyAssigned: true
      };
    }

    const created = await this.prisma.employee.create({
      data: { userId: source.userId, storeId: targetStoreId, role: "EMPLOYEE" }
    });
    return {
      employeeId: created.id,
      userId: source.userId,
      storeId: targetStoreId,
      alreadyAssigned: false
    };
  }

  /**
   * List every EMPLOYEE-role assignment for a single user, scoped to
   * stores the requesting owner owns. Used by the admin UI to show
   * "Maya works at: Store #1, Store #3" with per-store unassign actions.
   */
  async listAssignmentsForUser(user: RequestUser, employeeUserId: string) {
    this.assertOwner(user);
    return this.prisma.employee.findMany({
      where: {
        userId: employeeUserId,
        store: { ownerId: user.ownerId },
        deletedAt: null,
        role: "EMPLOYEE"
      },
      include: { store: true },
      orderBy: { store: { storeName: "asc" } }
    });
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
      include: { employees: true }
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

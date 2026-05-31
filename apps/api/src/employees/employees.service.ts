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
import {
  assertAccountAdmin,
  assertScopeAllowsStore,
  resolveAdminScope,
  storeWhereForScope
} from "../auth/admin-scope";
import { SmsService } from "../notifications/sms.service";
import { EmailService } from "../notifications/email.service";
import { InviteEmployeeDto } from "./dto/invite-employee.dto";

@Injectable()
export class EmployeesService {
  private readonly supabase?: SupabaseClient;

  constructor(
    private readonly prisma: PrismaService,
    private readonly sms: SmsService,
    private readonly email: EmailService
  ) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (url && key) {
      this.supabase = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false }
      });
    }
  }

  async listForOwner(user: RequestUser) {
    const scope = resolveAdminScope(user);
    // EMPLOYEE + MANAGER assignments (a per-store admin may have ONLY MANAGER
    // rows, so excluding them would hide that person entirely). OWNER-role rows
    // are auto-created so the owner can close their own stores and aren't
    // "employees" from the admin's POV, so they're excluded. The row's `role`
    // is returned so the UI can badge which stores a person manages. A manager
    // sees only the employees of the stores they manage (storeWhereForScope).
    return this.prisma.employee.findMany({
      where: {
        store: storeWhereForScope(scope),
        deletedAt: null,
        role: { in: ["EMPLOYEE", "MANAGER"] }
      },
      include: { user: true, store: true },
      orderBy: { user: { name: "asc" } }
    });
  }

  async invite(user: RequestUser, input: InviteEmployeeDto) {
    const scope = resolveAdminScope(user);
    assertScopeAllowsStore(scope, input.storeId);

    const email = input.email?.trim() || undefined;
    const phone = input.phone?.trim() || undefined;
    if (!email && !phone) {
      throw new BadRequestException("Provide an email or phone for the employee.");
    }

    // Twilio A2P 10DLC: every phone-channel invite MUST carry an explicit
    // owner attestation. We reject before any user/auth side-effects so
    // partial state never lands when the UI forgets the checkbox.
    if (phone) {
      if (!input.consent || input.consent.granted !== true || !input.consent.text?.trim()) {
        throw new BadRequestException(
          "SMS consent is required to invite an employee by phone."
        );
      }
    }

    // Store must be within the caller's admin scope (owner: any of their
    // stores; manager: only stores they manage — already gated above).
    const store = await this.prisma.store.findFirst({
      where: { id: input.storeId, ownerId: scope.ownerId, deletedAt: null }
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
            email: syntheticEmail!,
            password: tempPassword,
            email_confirm: true,
            user_metadata: { name: input.name, phone, role: "EMPLOYEE", signup_channel: "phone" }
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

    // Persist the consent record IMMEDIATELY after the user/employee row so
    // it's queryable before we attempt any SMS. The downstream
    // SmsService.sendEmployeeWelcome refuses to send unless an active
    // (non-opted-out) phone_consents row exists for the target phone.
    if (phone && input.consent) {
      await this.prisma.phoneConsent.create({
        data: {
          phone,
          employeeId: created.employees[0]?.id,
          consentedByUserId: user.id,
          storeId: input.storeId,
          consentMethod: "owner_attestation_v1",
          consentText: input.consent.text
        }
      });
    }

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

    // Best-effort branded welcome email for email invites — delivers the temp
    // password + sign-in link so the owner doesn't have to share it manually.
    // Never blocks the invite (same contract as the SMS path).
    let emailSent = false;
    let emailError: string | undefined;
    if (email) {
      const result = await this.email.sendEmployeeWelcome({
        email,
        name: input.name,
        storeName: store.storeName,
        tempPassword
      });
      emailSent = result.sent;
      emailError = result.error;
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
      smsError: smsError ?? null,
      emailSent,
      emailError: emailError ?? null
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
    const scope = resolveAdminScope(user);
    assertScopeAllowsStore(scope, targetStoreId);

    // Verify the source employee belongs to a store within the caller's scope
    // (i.e. they have the right to "transfer/extend" this employee).
    const source = await this.prisma.employee.findFirst({
      where: { id: employeeId, store: storeWhereForScope(scope), deletedAt: null },
      include: { user: true }
    });
    if (!source) throw new NotFoundException("Employee not found.");

    // Target store must also be within scope (owner's store / managed store).
    const targetStore = await this.prisma.store.findFirst({
      where: { id: targetStoreId, ownerId: scope.ownerId, deletedAt: null }
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
    const scope = resolveAdminScope(user);
    return this.prisma.employee.findMany({
      where: {
        userId: employeeUserId,
        store: storeWhereForScope(scope),
        deletedAt: null,
        role: "EMPLOYEE"
      },
      include: { store: true },
      orderBy: { store: { storeName: "asc" } }
    });
  }

  async resetPassword(user: RequestUser, employeeId: string) {
    const scope = resolveAdminScope(user);

    const emp = await this.prisma.employee.findFirst({
      where: { id: employeeId, store: storeWhereForScope(scope) },
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
    // Granting ACCOUNT-WIDE admin is reserved for the account owner. Managers
    // (per-store admins) cannot mint other admins.
    const scope = assertAccountAdmin(user);

    const emp = await this.prisma.employee.findFirst({
      where: { id: employeeId, store: { ownerId: scope.ownerId }, deletedAt: null },
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

  /**
   * Set the EXACT set of stores a user is a per-store admin (MANAGER) of.
   * Account-owner only — managers can't delegate manager access.
   *
   * For each store in `storeIds` (which must all belong to the owner) we ensure
   * a MANAGER assignment row exists (creating or undeleting + upgrading from
   * EMPLOYEE as needed). Any store the user currently manages that's NOT in the
   * list is downgraded back to EMPLOYEE (the assignment row is kept so they stay
   * assigned to the store, just without admin powers).
   *
   * Returns the resulting set of managed store ids so the UI can reconcile.
   */
  async setManagerStores(user: RequestUser, employeeUserId: string, storeIds: string[]) {
    const scope = assertAccountAdmin(user);

    if (employeeUserId === user.id) {
      throw new BadRequestException("You cannot change your own access.");
    }

    // Validate every requested store belongs to the owner.
    const desired = Array.from(new Set(storeIds));
    if (desired.length > 0) {
      const owned = await this.prisma.store.findMany({
        where: { id: { in: desired }, ownerId: scope.ownerId, deletedAt: null },
        select: { id: true }
      });
      if (owned.length !== desired.length) {
        throw new BadRequestException("One or more stores are not yours.");
      }
    }

    // The target must already be an employee under this owner (you delegate
    // admin to someone who works for you, not to an arbitrary user).
    const existing = await this.prisma.employee.findMany({
      where: { userId: employeeUserId, store: { ownerId: scope.ownerId }, deletedAt: null }
    });
    if (existing.length === 0) {
      throw new NotFoundException("Employee not found.");
    }
    const target = await this.prisma.user.findUnique({ where: { id: employeeUserId } });
    if (target && target.role === "STORE_OWNER") {
      throw new BadRequestException("This person already has account-wide admin.");
    }

    const desiredSet = new Set(desired);
    const existingByStore = new Map(existing.map((e) => [e.storeId, e]));

    await this.prisma.$transaction(async (tx) => {
      // Promote / create MANAGER rows for desired stores.
      for (const storeId of desired) {
        const row = existingByStore.get(storeId);
        if (row) {
          if (row.role !== "MANAGER") {
            await tx.employee.update({ where: { id: row.id }, data: { role: "MANAGER" } });
          }
        } else {
          await tx.employee.create({
            data: { userId: employeeUserId, storeId, role: "MANAGER" }
          });
        }
      }
      // Downgrade any currently-managed store no longer desired back to EMPLOYEE.
      for (const row of existing) {
        if (row.role === "MANAGER" && !desiredSet.has(row.storeId)) {
          await tx.employee.update({ where: { id: row.id }, data: { role: "EMPLOYEE" } });
        }
      }
    });

    return { userId: employeeUserId, managedStoreIds: desired };
  }

  async remove(user: RequestUser, employeeId: string) {
    const scope = resolveAdminScope(user);

    const emp = await this.prisma.employee.findFirst({
      where: { id: employeeId, store: storeWhereForScope(scope), deletedAt: null },
      include: { user: true }
    });
    if (!emp) throw new NotFoundException("Employee not found.");

    // Soft-delete THIS assignment row (preserves daily_close FK history).
    await this.prisma.employee.update({
      where: { id: employeeId },
      data: { deletedAt: new Date() }
    });

    // Only kill the login when this was their LAST active assignment. A
    // multi-store employee unassigned from one store must keep signing in for
    // the stores that remain — deleting the Supabase auth user here used to
    // lock them out of everything.
    const remaining = await this.prisma.employee.count({
      where: { userId: emp.userId, deletedAt: null }
    });
    if (remaining === 0 && this.supabase && emp.user.authUserId) {
      try {
        await this.supabase.auth.admin.deleteUser(emp.user.authUserId);
      } catch {
        // ignore - already gone or permission issue; soft delete is what matters
      }
    }

    return { employeeId, deleted: true, loginRevoked: remaining === 0 };
  }
}

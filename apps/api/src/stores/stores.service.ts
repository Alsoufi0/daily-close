import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { RequestUser } from "../auth/request-user";
import { assertScopeAllowsStore, resolveAdminScope } from "../auth/admin-scope";
import { PrismaService } from "../prisma/prisma.service";
import { SubscriptionsService } from "../subscriptions/subscriptions.service";
import { CreateStoreDto } from "./dto/create-store.dto";
import { UpdateStoreDto } from "./dto/update-store.dto";

@Injectable()
export class StoresService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptions: SubscriptionsService
  ) {}

  async listForUser(user: RequestUser) {
    if (user.role === "STORE_OWNER" && user.ownerId) {
      return this.prisma.store.findMany({
        where: { ownerId: user.ownerId, deletedAt: null },
        orderBy: { storeName: "asc" }
      });
    }

    if (user.role === "EMPLOYEE") {
      // Post Phase 1 / migration 006: an employee can have many active
      // assignments. Return every store the user is assigned to (not
      // just the primary one from user.storeId, which was the only
      // store the legacy single-employee-row model could represent).
      // Any assignment role counts (EMPLOYEE close access OR MANAGER
      // per-store admin) so a manager sees the stores they administer.
      return this.prisma.store.findMany({
        where: {
          deletedAt: null,
          employees: {
            some: { userId: user.id, deletedAt: null, role: { in: ["EMPLOYEE", "MANAGER"] } }
          }
        },
        orderBy: { storeName: "asc" }
      });
    }

    throw new ForbiddenException("No stores are available for this user.");
  }

  async deleteForOwner(user: RequestUser, storeId: string) {
    if (user.role !== "STORE_OWNER" || !user.ownerId) {
      throw new ForbiddenException("Only owners can delete stores.");
    }
    const existing = await this.prisma.store.findFirst({
      where: { id: storeId, ownerId: user.ownerId, deletedAt: null }
    });
    if (!existing) throw new NotFoundException("Store not found.");

    await this.prisma.store.update({
      where: { id: storeId },
      data: { deletedAt: new Date() }
    });
    // Also archive the employees attached to this store so they can't sign in to it.
    await this.prisma.employee.updateMany({
      where: { storeId, deletedAt: null },
      data: { deletedAt: new Date() }
    });
    await this.prisma.auditLog.create({
      data: { userId: user.id, storeId, action: "store.deleted", metadata: {} }
    });
    try {
      await this.subscriptions.syncStoreQuantityForOwner(user.ownerId);
    } catch (err) {
      await this.prisma.auditLog.create({
        data: {
          userId: user.id,
          storeId,
          action: "billing.store_quantity_sync_needed",
          metadata: { message: err instanceof Error ? err.message : String(err) }
        }
      });
    }
    return { id: storeId, deleted: true };
  }

  async createForOwner(user: RequestUser, input: CreateStoreDto) {
    if (user.role !== "STORE_OWNER" || !user.ownerId) {
      throw new ForbiddenException("Only owners can create stores.");
    }
    await this.subscriptions.ensureActiveForOwner(user.ownerId);
    // Create the store AND the owner's OWNER-role assignment row in one
    // transaction. Post migration 006 the assignment row is what
    // assertCanCloseStore looks for to authorise owner closes; creating
    // it lazily on first close (which would still work) would leave a
    // window where listing assignments for the owner misses the new
    // store. Atomic create avoids that.
    const store = await this.prisma.$transaction(async (tx) => {
      const created = await tx.store.create({
        data: {
          ownerId: user.ownerId!,
          storeName: input.storeName,
          address: input.address,
          phone: input.phone,
          timezone: this.validTimezone(input.timezone),
          closeTime: this.validCloseTime(input.closeTime)
        }
      });
      await tx.employee.create({
        data: { userId: user.id, storeId: created.id, role: "OWNER" }
      });
      return created;
    });
    try {
      await this.subscriptions.syncStoreQuantityForOwner(user.ownerId);
    } catch (err) {
      await this.prisma.store.update({
        where: { id: store.id },
        data: { deletedAt: new Date() }
      });
      await this.prisma.employee.updateMany({
        where: { storeId: store.id, deletedAt: null },
        data: { deletedAt: new Date() }
      });
      await this.prisma.auditLog.create({
        data: {
          userId: user.id,
          storeId: store.id,
          action: "billing.store_quantity_sync_failed",
          metadata: { message: err instanceof Error ? err.message : String(err) }
        }
      });
      throw new BadRequestException("Store was not added because payment could not be confirmed. Please update billing and try again.");
    }
    return store;
  }

  async updateForOwner(user: RequestUser, storeId: string, input: UpdateStoreDto) {
    // Account owners edit any of their stores; per-store managers edit only the
    // stores they manage. (Store create/delete stays owner-only — see above.)
    const scope = resolveAdminScope(user);
    assertScopeAllowsStore(scope, storeId);
    const existing = await this.prisma.store.findFirst({
      where: { id: storeId, ownerId: scope.ownerId, deletedAt: null }
    });
    if (!existing) throw new NotFoundException("Store not found.");

    const data: Record<string, any> = {};
    if (input.storeName !== undefined) data.storeName = input.storeName;
    if (input.address !== undefined) data.address = input.address;
    if (input.phone !== undefined) data.phone = input.phone;
    if (input.timezone !== undefined) data.timezone = this.validTimezone(input.timezone);
    if (input.closeTime !== undefined) data.closeTime = this.validCloseTime(input.closeTime);

    const updated = await this.prisma.store.update({ where: { id: storeId }, data });
    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        storeId,
        action: "store.updated",
        metadata: input as any
      }
    });
    return updated;
  }

  private validTimezone(timezone?: string): string {
    const value = timezone || "America/New_York";
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date());
      return value;
    } catch {
      throw new BadRequestException("Choose a valid store timezone.");
    }
  }

  private validCloseTime(closeTime?: string): string {
    const value = closeTime || "23:30";
    if (!/^\d{2}:\d{2}$/.test(value)) {
      throw new BadRequestException("Choose a valid daily close time.");
    }
    const [hh, mm] = value.split(":").map(Number);
    if (hh < 0 || hh > 23 || mm < 0 || mm > 59) {
      throw new BadRequestException("Choose a valid daily close time.");
    }
    return value;
  }
}

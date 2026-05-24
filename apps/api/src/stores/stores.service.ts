import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { RequestUser } from "../auth/request-user";
import { PrismaService } from "../prisma/prisma.service";
import { CreateStoreDto } from "./dto/create-store.dto";
import { UpdateStoreDto } from "./dto/update-store.dto";

@Injectable()
export class StoresService {
  constructor(private readonly prisma: PrismaService) {}

  async listForUser(user: RequestUser) {
    if (user.role === "STORE_OWNER" && user.ownerId) {
      return this.prisma.store.findMany({
        where: { ownerId: user.ownerId, deletedAt: null },
        orderBy: { storeName: "asc" }
      });
    }

    if (user.role === "EMPLOYEE" && user.storeId) {
      return this.prisma.store.findMany({ where: { id: user.storeId, deletedAt: null } });
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
    return { id: storeId, deleted: true };
  }

  async createForOwner(user: RequestUser, input: CreateStoreDto) {
    if (user.role !== "STORE_OWNER" || !user.ownerId) {
      throw new ForbiddenException("Only owners can create stores.");
    }
    return this.prisma.store.create({
      data: {
        ownerId: user.ownerId,
        storeName: input.storeName,
        address: input.address,
        phone: input.phone,
        timezone: this.validTimezone(input.timezone),
        closeTime: this.validCloseTime(input.closeTime)
      }
    });
  }

  async updateForOwner(user: RequestUser, storeId: string, input: UpdateStoreDto) {
    if (user.role !== "STORE_OWNER" || !user.ownerId) {
      throw new ForbiddenException("Only owners can edit stores.");
    }
    const existing = await this.prisma.store.findFirst({
      where: { id: storeId, ownerId: user.ownerId, deletedAt: null }
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

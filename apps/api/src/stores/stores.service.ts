import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
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
        where: { ownerId: user.ownerId },
        orderBy: { storeName: "asc" }
      });
    }

    if (user.role === "EMPLOYEE" && user.storeId) {
      return this.prisma.store.findMany({ where: { id: user.storeId } });
    }

    throw new ForbiddenException("No stores are available for this user.");
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
        timezone: input.timezone ?? "America/New_York",
        closeTime: input.closeTime ?? "23:30"
      }
    });
  }

  async updateForOwner(user: RequestUser, storeId: string, input: UpdateStoreDto) {
    if (user.role !== "STORE_OWNER" || !user.ownerId) {
      throw new ForbiddenException("Only owners can edit stores.");
    }
    const existing = await this.prisma.store.findFirst({
      where: { id: storeId, ownerId: user.ownerId }
    });
    if (!existing) throw new NotFoundException("Store not found.");

    const data: Record<string, any> = {};
    if (input.storeName !== undefined) data.storeName = input.storeName;
    if (input.address !== undefined) data.address = input.address;
    if (input.phone !== undefined) data.phone = input.phone;
    if (input.timezone !== undefined) data.timezone = input.timezone;
    if (input.closeTime !== undefined) data.closeTime = input.closeTime;

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
}

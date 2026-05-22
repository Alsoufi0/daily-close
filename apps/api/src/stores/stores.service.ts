import { ForbiddenException, Injectable } from "@nestjs/common";
import { RequestUser } from "../auth/request-user";
import { PrismaService } from "../prisma/prisma.service";
import { CreateStoreDto } from "./dto/create-store.dto";

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
}

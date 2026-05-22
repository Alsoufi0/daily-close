import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { RequestUser } from "../auth/request-user";

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async sendMissingCloseAlert(storeName: string): Promise<{ sent: boolean; message: string }> {
    return {
      sent: true,
      message: `${storeName} has not completed closing.`
    };
  }

  listForUser(user: RequestUser) {
    return this.prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 25
    });
  }

  async markRead(id: string, user: RequestUser) {
    const existing = await this.prisma.notification.findFirst({
      where: { id, userId: user.id }
    });
    if (!existing) throw new NotFoundException("Notification not found.");
    return this.prisma.notification.update({
      where: { id },
      data: { status: "READ" }
    });
  }

  async remove(id: string, user: RequestUser) {
    const existing = await this.prisma.notification.findFirst({
      where: { id, userId: user.id }
    });
    if (!existing) throw new NotFoundException("Notification not found.");
    await this.prisma.notification.delete({ where: { id } });
    return { id, deleted: true };
  }
}

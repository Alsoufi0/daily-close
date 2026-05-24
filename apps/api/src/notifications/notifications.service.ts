import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
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

  async getWhatsAppSettings(user: RequestUser) {
    if (user.role !== "STORE_OWNER" || !user.ownerId) {
      throw new ForbiddenException("Only owners can manage WhatsApp settings.");
    }
    const owner = await this.prisma.owner.findUnique({ where: { id: user.ownerId } });
    if (!owner) throw new NotFoundException("Owner not found.");
    return {
      whatsappPhone: (owner as any).whatsappPhone ?? null,
      whatsappAlertsEnabled: Boolean((owner as any).whatsappAlertsEnabled),
      whatsappReportsEnabled: Boolean((owner as any).whatsappReportsEnabled)
    };
  }

  async updateWhatsAppSettings(
    user: RequestUser,
    input: { whatsappPhone?: string | null; whatsappAlertsEnabled?: boolean; whatsappReportsEnabled?: boolean }
  ) {
    if (user.role !== "STORE_OWNER" || !user.ownerId) {
      throw new ForbiddenException("Only owners can manage WhatsApp settings.");
    }
    const cleanPhone = input.whatsappPhone ? this.normalizePhone(input.whatsappPhone) : null;
    if ((input.whatsappAlertsEnabled || input.whatsappReportsEnabled) && !cleanPhone) {
      throw new BadRequestException("Enter a WhatsApp phone number before turning on WhatsApp messages.");
    }
    const updated = await this.prisma.owner.update({
      where: { id: user.ownerId },
      data: {
        whatsappPhone: cleanPhone,
        whatsappAlertsEnabled: Boolean(input.whatsappAlertsEnabled),
        whatsappReportsEnabled: Boolean(input.whatsappReportsEnabled)
      } as any
    });
    return {
      whatsappPhone: (updated as any).whatsappPhone ?? null,
      whatsappAlertsEnabled: Boolean((updated as any).whatsappAlertsEnabled),
      whatsappReportsEnabled: Boolean((updated as any).whatsappReportsEnabled)
    };
  }

  private normalizePhone(input: string): string {
    const trimmed = input.trim();
    const digits = trimmed.replace(/[^\d+]/g, "");
    const e164 = digits.startsWith("+") ? digits : `+${digits.replace(/[^\d]/g, "")}`;
    if (!/^\+\d{8,15}$/.test(e164)) {
      throw new BadRequestException("Enter the phone number with country code, like +15551234567.");
    }
    return e164;
  }
}

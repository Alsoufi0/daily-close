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
    return this.readWhatsAppSettings(user.ownerId);
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
    await this.writeWhatsAppSettings(user.ownerId, {
      whatsappPhone: cleanPhone,
      alertsEnabled: Boolean(input.whatsappAlertsEnabled),
      reportsEnabled: Boolean(input.whatsappReportsEnabled)
    });
    return this.readWhatsAppSettings(user.ownerId);
  }

  async readWhatsAppSettings(ownerId: string) {
    try {
      const rows = await this.prisma.$queryRawUnsafe<Array<{
        whatsapp_phone: string | null;
        alerts_enabled: boolean;
        reports_enabled: boolean;
      }>>(
        `select whatsapp_phone, alerts_enabled, reports_enabled
         from public.owner_whatsapp_preferences
         where owner_id = $1
         limit 1`,
        ownerId
      );
      const row = rows[0];
      return {
        whatsappPhone: row?.whatsapp_phone ?? null,
        whatsappAlertsEnabled: Boolean(row?.alerts_enabled),
        whatsappReportsEnabled: Boolean(row?.reports_enabled)
      };
    } catch {
      return {
        whatsappPhone: null,
        whatsappAlertsEnabled: false,
        whatsappReportsEnabled: false
      };
    }
  }

  private async writeWhatsAppSettings(
    ownerId: string,
    input: { whatsappPhone: string | null; alertsEnabled: boolean; reportsEnabled: boolean }
  ) {
    try {
      await this.upsertWhatsAppSettings(ownerId, input);
    } catch (err) {
      if (!this.isMissingWhatsAppTableError(err)) {
        throw err;
      }
      await this.ensureWhatsAppSettingsTable();
      await this.upsertWhatsAppSettings(ownerId, input);
    }
  }

  private async upsertWhatsAppSettings(
    ownerId: string,
    input: { whatsappPhone: string | null; alertsEnabled: boolean; reportsEnabled: boolean }
  ) {
    await this.prisma.$executeRawUnsafe(
      `insert into public.owner_whatsapp_preferences
         (owner_id, whatsapp_phone, alerts_enabled, reports_enabled, updated_at)
       values ($1, $2, $3, $4, now())
       on conflict (owner_id)
       do update set
         whatsapp_phone = excluded.whatsapp_phone,
         alerts_enabled = excluded.alerts_enabled,
         reports_enabled = excluded.reports_enabled,
         updated_at = now()`,
      ownerId,
      input.whatsappPhone,
      input.alertsEnabled,
      input.reportsEnabled
    );
  }

  private async ensureWhatsAppSettingsTable() {
    await this.prisma.$executeRawUnsafe(
      `create table if not exists public.owner_whatsapp_preferences (
        owner_id text primary key references public.owners(id) on delete cascade,
        whatsapp_phone text,
        alerts_enabled boolean not null default false,
        reports_enabled boolean not null default false,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )`
    );
  }

  private isMissingWhatsAppTableError(err: unknown): boolean {
    const code = (err as { code?: string })?.code;
    const message = (err as { message?: string })?.message || "";
    return code === "42P01" || /owner_whatsapp_preferences|relation .* does not exist/i.test(message);
  }

  async getOwnerWhatsAppPreferences(ownerId: string) {
    const settings = await this.readWhatsAppSettings(ownerId);
    return {
      phone: settings.whatsappPhone,
      alertsEnabled: settings.whatsappAlertsEnabled,
      reportsEnabled: settings.whatsappReportsEnabled
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

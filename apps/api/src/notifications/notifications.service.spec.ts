import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { NotificationsService } from "./notifications.service";
import { RequestUser } from "../auth/request-user";

const user: RequestUser = {
  id: "user-1",
  name: "Owner",
  email: "o@demo.com",
  role: "STORE_OWNER",
  ownerId: "owner-1"
};

describe("NotificationsService.markRead", () => {
  it("marks the notification READ when it belongs to the user", async () => {
    const prisma = {
      notification: {
        findFirst: jest.fn().mockResolvedValue({ id: "n1", userId: "user-1" }),
        update: jest.fn().mockResolvedValue({ id: "n1", status: "READ" })
      }
    } as any;
    const service = new NotificationsService(prisma);
    const result = await service.markRead("n1", user);
    expect(prisma.notification.findFirst).toHaveBeenCalledWith({
      where: { id: "n1", userId: "user-1" }
    });
    expect(prisma.notification.update).toHaveBeenCalledWith({
      where: { id: "n1" },
      data: { status: "READ" }
    });
    expect(result.status).toBe("READ");
  });

  it("throws NotFound when the notification belongs to another user", async () => {
    const prisma = {
      notification: {
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn()
      }
    } as any;
    const service = new NotificationsService(prisma);
    await expect(service.markRead("n1", user)).rejects.toThrow(NotFoundException);
    expect(prisma.notification.update).not.toHaveBeenCalled();
  });
});

describe("NotificationsService WhatsApp settings", () => {
  it("lets owners save WhatsApp number and preferences", async () => {
    const prisma = {
      owner: {
        update: jest.fn().mockResolvedValue({
          whatsappPhone: "+15551234567",
          whatsappAlertsEnabled: true,
          whatsappReportsEnabled: true
        })
      }
    } as any;
    const service = new NotificationsService(prisma);
    const result = await service.updateWhatsAppSettings(user, {
      whatsappPhone: "+15551234567",
      whatsappAlertsEnabled: true,
      whatsappReportsEnabled: true
    });
    expect(prisma.owner.update).toHaveBeenCalledWith({
      where: { id: "owner-1" },
      data: {
        whatsappPhone: "+15551234567",
        whatsappAlertsEnabled: true,
        whatsappReportsEnabled: true
      }
    });
    expect(result.whatsappReportsEnabled).toBe(true);
  });

  it("requires a valid phone before enabling WhatsApp", async () => {
    const service = new NotificationsService({ owner: { update: jest.fn() } } as any);
    await expect(
      service.updateWhatsAppSettings(user, {
        whatsappPhone: "",
        whatsappAlertsEnabled: true,
        whatsappReportsEnabled: false
      })
    ).rejects.toThrow(BadRequestException);
  });

  it("forbids employees from changing owner WhatsApp settings", async () => {
    const service = new NotificationsService({ owner: { update: jest.fn() } } as any);
    await expect(
      service.updateWhatsAppSettings(
        { ...user, role: "EMPLOYEE", ownerId: undefined },
        { whatsappPhone: "+15551234567", whatsappAlertsEnabled: true, whatsappReportsEnabled: true }
      )
    ).rejects.toThrow(ForbiddenException);
  });
});

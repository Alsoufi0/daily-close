import { NotFoundException } from "@nestjs/common";
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

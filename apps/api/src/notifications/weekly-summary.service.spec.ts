import { WeeklySummaryService } from "./weekly-summary.service";

describe("WeeklySummaryService WhatsApp reports", () => {
  it("sends WhatsApp weekly summary when owner opted in", async () => {
    const prisma = {
      owner: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: "owner-1",
            user: { email: "owner@example.com", name: "Owner" },
            stores: [
              {
                dailyCloses: [
                  { totalSales: 1000, cashSales: 400, difference: -10 }
                ]
              }
            ]
          }
        ])
      }
    };
    const whatsapp = { isConfigured: jest.fn().mockReturnValue(true), sendSummaryTemplate: jest.fn().mockResolvedValue(true) };
    const sms = { sendWhatsAppTemplate: jest.fn().mockResolvedValue({ sent: true }) };
    const notifications = {
      getOwnerWhatsAppPreferences: jest.fn().mockResolvedValue({
        phone: "+15551234567",
        alertsEnabled: true,
        reportsEnabled: true
      })
    };
    const service = new WeeklySummaryService(prisma as any, whatsapp as any, notifications as any, sms as any);

    const result = await service.sendForAllOwners(new Date("2026-05-25T12:00:00.000Z"));

    expect(result.sent).toBe(1);
    expect(whatsapp.sendSummaryTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        toPhone: "+15551234567",
        period: "weekly",
        sales: "$1000.00",
        closes: "1",
        cashDifference: "$-10.00"
      })
    );
  });

  it("uses monthly period and 30-day range for monthly summaries", async () => {
    const prisma = {
      owner: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: "owner-1",
            user: { email: "owner@example.com", name: "Owner" },
            stores: [{ dailyCloses: [] }]
          }
        ])
      }
    };
    const whatsapp = { isConfigured: jest.fn().mockReturnValue(true), sendSummaryTemplate: jest.fn().mockResolvedValue(true) };
    const sms = { sendWhatsAppTemplate: jest.fn().mockResolvedValue({ sent: true }) };
    const notifications = {
      getOwnerWhatsAppPreferences: jest.fn().mockResolvedValue({
        phone: "+15551234567",
        alertsEnabled: true,
        reportsEnabled: true
      })
    };
    const service = new WeeklySummaryService(prisma as any, whatsapp as any, notifications as any, sms as any);

    await service.sendMonthlyForAllOwners(new Date("2026-05-30T12:00:00.000Z"));

    expect(prisma.owner.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          stores: expect.objectContaining({
            where: { deletedAt: null }
          })
        })
      })
    );
    expect(whatsapp.sendSummaryTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ period: "monthly", from: "2026-05-01", to: "2026-05-30" })
    );
  });
});

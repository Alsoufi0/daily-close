import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { CommissionsService } from "./commissions.service";

function makeService(overrides?: {
  owner?: any;
  defaultRate?: number;
  createImpl?: (args: any) => any;
}) {
  const created: any[] = [];
  const prisma: any = {
    owner: {
      findUnique: jest.fn().mockResolvedValue(overrides?.owner ?? null)
    },
    commission: {
      create: jest.fn(async (args: any) => {
        if (overrides?.createImpl) return overrides.createImpl(args);
        created.push(args.data);
        return { id: "c1", ...args.data };
      }),
      findUnique: jest.fn(),
      update: jest.fn(async (args: any) => ({ id: args.where.id, ...args.data }))
    }
  };
  const settings: any = {
    getDefaultRate: jest.fn().mockResolvedValue(overrides?.defaultRate ?? 0.25)
  };
  const service = new CommissionsService(prisma, settings);
  return { service, prisma, settings, created };
}

const referredOwner = (commissionRate: number | null) => ({
  id: "owner-1",
  referredByPartnerId: "partner-1",
  referredBy: { commissionRate }
});

describe("CommissionsService.recordInvoicePayment", () => {
  it("skips $0 (trial) invoices without touching the DB", async () => {
    const { service, prisma } = makeService();
    const res = await service.recordInvoicePayment({
      stripeInvoiceId: "in_trial",
      stripeCustomerId: "cus_1",
      amountPaidCents: 0
    });
    expect(res).toEqual({ created: false, reason: "zero_amount" });
    expect(prisma.owner.findUnique).not.toHaveBeenCalled();
  });

  it("does nothing when there is no owner for the customer", async () => {
    const { service } = makeService({ owner: null });
    const res = await service.recordInvoicePayment({
      stripeInvoiceId: "in_1",
      stripeCustomerId: "cus_unknown",
      amountPaidCents: 4999
    });
    expect(res).toEqual({ created: false, reason: "no_owner" });
  });

  it("does nothing when the owner was not referred", async () => {
    const { service } = makeService({
      owner: { id: "owner-2", referredByPartnerId: null, referredBy: null }
    });
    const res = await service.recordInvoicePayment({
      stripeInvoiceId: "in_2",
      stripeCustomerId: "cus_2",
      amountPaidCents: 4999
    });
    expect(res).toEqual({ created: false, reason: "not_referred" });
  });

  it("mints a commission at the platform default rate, snapshotting the rate", async () => {
    const { service, created } = makeService({ owner: referredOwner(null), defaultRate: 0.25 });
    const res = await service.recordInvoicePayment({
      stripeInvoiceId: "in_3",
      stripeCustomerId: "cus_3",
      amountPaidCents: 4999,
      currency: "usd"
    });
    expect(res).toEqual({ created: true, commissionId: "c1" });
    expect(created).toHaveLength(1);
    const row = created[0];
    expect(row.partnerId).toBe("partner-1");
    expect(row.ownerId).toBe("owner-1");
    expect(row.stripeInvoiceId).toBe("in_3");
    expect(Number(row.rate)).toBe(0.25);
    // 4999 * 0.25 = 1249.75 → round → 1250 cents → $12.50
    expect(Number(row.amount)).toBe(12.5);
    expect(row.sourceAmountCents).toBe(4999);
    expect(row.status).toBe("PENDING");
  });

  it("uses the per-partner override rate when present", async () => {
    const { service, created } = makeService({ owner: referredOwner(0.4), defaultRate: 0.25 });
    await service.recordInvoicePayment({
      stripeInvoiceId: "in_4",
      stripeCustomerId: "cus_4",
      amountPaidCents: 10000
    });
    expect(Number(created[0].rate)).toBe(0.4);
    expect(Number(created[0].amount)).toBe(40); // 10000 * 0.4 = 4000c = $40
  });

  it("is idempotent: a duplicate invoice (P2002) creates no second row", async () => {
    const { service } = makeService({
      owner: referredOwner(null),
      createImpl: () => {
        throw new Prisma.PrismaClientKnownRequestError("dup", {
          code: "P2002",
          clientVersion: "5.22.0"
        });
      }
    });
    const res = await service.recordInvoicePayment({
      stripeInvoiceId: "in_dup",
      stripeCustomerId: "cus_5",
      amountPaidCents: 4999
    });
    expect(res).toEqual({ created: false, reason: "already_recorded" });
  });
});

describe("CommissionsService.reverseByInvoice", () => {
  it("reverses the matching row", async () => {
    const { service, prisma } = makeService();
    prisma.commission.findUnique.mockResolvedValue({ id: "c9", status: "PENDING" });
    const res = await service.reverseByInvoice("in_9");
    expect(res).toEqual({ reversed: true });
    expect(prisma.commission.update).toHaveBeenCalledWith({
      where: { id: "c9" },
      data: { status: "REVERSED" }
    });
  });

  it("is a no-op when there is no matching commission", async () => {
    const { service, prisma } = makeService();
    prisma.commission.findUnique.mockResolvedValue(null);
    expect(await service.reverseByInvoice("in_none")).toEqual({ reversed: false });
    expect(prisma.commission.update).not.toHaveBeenCalled();
  });

  it("does not double-reverse an already reversed row", async () => {
    const { service, prisma } = makeService();
    prisma.commission.findUnique.mockResolvedValue({ id: "c9", status: "REVERSED" });
    expect(await service.reverseByInvoice("in_9")).toEqual({ reversed: false });
    expect(prisma.commission.update).not.toHaveBeenCalled();
  });
});

describe("CommissionsService.updateStatus", () => {
  it("requires a payout reference to mark PAID", async () => {
    const { service, prisma } = makeService();
    prisma.commission.findUnique.mockResolvedValue({ id: "c1", status: "APPROVED" });
    await expect(service.updateStatus("c1", "PAID")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("refuses to mark PAID until the row has been APPROVED", async () => {
    const { service, prisma } = makeService();
    prisma.commission.findUnique.mockResolvedValue({ id: "c1", status: "PENDING" });
    // Even with a payout reference, a non-approved row cannot be paid.
    await expect(service.updateStatus("c1", "PAID", "ref_1")).rejects.toBeInstanceOf(
      BadRequestException
    );
    expect(prisma.commission.update).not.toHaveBeenCalled();
  });

  it("throws when the commission does not exist", async () => {
    const { service, prisma } = makeService();
    prisma.commission.findUnique.mockResolvedValue(null);
    await expect(service.updateStatus("missing", "APPROVED")).rejects.toBeInstanceOf(
      NotFoundException
    );
  });
});

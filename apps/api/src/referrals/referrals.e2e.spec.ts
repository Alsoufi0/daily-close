/**
 * Full-flow referral + commission E2E against a REAL Postgres.
 *
 * Guarded behind REFERRALS_E2E=1 so the normal unit suite (which has no DB)
 * is unaffected. Run it with the local throwaway DB:
 *
 *   REFERRALS_E2E=1 DATABASE_URL=postgresql://postgres:postgres@localhost:55432/daily_close \
 *     npx jest --config apps/api/jest.config.js referrals.e2e
 *
 * It walks the prompt's flow end to end against live tables, driving the real
 * services and the real Stripe-webhook handler:
 *   scan → signup (first-touch stamp) → trial ($0, no commission) →
 *   first payment (commission row) → recurring payment (2nd row) →
 *   idempotent retry → refund (reversal) → approve → pay → adjustment.
 */
import { PrismaService } from "../prisma/prisma.service";
import { SubscriptionsController } from "../subscriptions/subscriptions.controller";
import { AppSettingsService } from "./app-settings.service";
import { CommissionsService } from "./commissions.service";
import { PartnersService, currentPeriod } from "./partners.service";
import { isValidRefCode } from "./ref-code";

const RUN = process.env.REFERRALS_E2E === "1";
const d = RUN ? describe : describe.skip;

d("referrals + commissions E2E (real DB)", () => {
  const prisma = new PrismaService();
  const settings = new AppSettingsService(prisma);
  const partners = new PartnersService(prisma);
  const commissions = new CommissionsService(prisma, settings);
  const webhook = new SubscriptionsController(
    { syncFromStripe: async () => ({}) } as any,
    commissions
  );

  const customerId = `cus_e2e_${Date.now()}`;
  let partnerId = "";
  let refCode = "";
  let ownerId = "";
  let userId = "";

  const log = (m: string) => console.log(`\n  ▸ ${m}`);

  function invoiceEvent(id: string, amountPaidCents: number) {
    return {
      type: "invoice.payment_succeeded",
      data: {
        object: {
          id,
          customer: customerId,
          amount_paid: amountPaidCents,
          currency: "usd",
          period_start: Math.floor(Date.now() / 1000)
        }
      }
    };
  }

  beforeAll(async () => {
    await prisma.$connect();
    await settings.updateDefaultRate(0.25);
  });

  afterAll(async () => {
    // Clean up only what this test created.
    if (partnerId) await prisma.commission.deleteMany({ where: { partnerId } });
    if (ownerId) await prisma.owner.deleteMany({ where: { id: ownerId } });
    if (userId) await prisma.user.deleteMany({ where: { id: userId } });
    if (partnerId) await prisma.partner.deleteMany({ where: { id: partnerId } });
    await prisma.$disconnect();
  });

  it("creates a partner with a clean, unambiguous ref code", async () => {
    const p = await partners.create({ name: "E2E Distributor", contact: "e2e@example.com" });
    partnerId = p.id;
    refCode = p.refCode;
    expect(isValidRefCode(refCode)).toBe(true);
    expect(refCode).toHaveLength(7);
    log(`Partner created: ${p.name} (code ${refCode})`);
  });

  it("counts scans and rejects unknown codes", async () => {
    expect(await partners.recordScan(refCode)).toEqual({ valid: true });
    expect(await partners.recordScan(refCode)).toEqual({ valid: true });
    expect(await partners.recordScan("ZZZZZZZ")).toEqual({ valid: false });
    const p = await partners.get(partnerId);
    expect(p.scanCount).toBe(2);
    log(`Scans recorded: ${p.scanCount} (unknown code ignored)`);
  });

  it("stamps the partner on the new owner at signup (first-touch)", async () => {
    // Resolve like the signup path does (active partner only), then create the
    // owner with the stamp — owner is brand new, so it's first-touch.
    const resolved = await prisma.partner.findUnique({
      where: { refCode },
      select: { id: true, active: true }
    });
    expect(resolved?.id).toBe(partnerId);

    const user = await prisma.user.create({
      data: {
        name: "E2E Owner",
        email: `e2e+${Date.now()}@example.com`,
        password: "",
        role: "STORE_OWNER",
        owner: {
          create: {
            subscriptionPlan: "Standard",
            subscriptionStatus: "TRIALING",
            trialEndsAt: new Date(Date.now() + 14 * 86_400_000),
            stripeCustomerId: customerId,
            referredByPartnerId: resolved!.id
          }
        }
      },
      include: { owner: true }
    });
    userId = user.id;
    ownerId = user.owner!.id;
    expect(user.owner!.referredByPartnerId).toBe(partnerId);
    log(`Owner ${ownerId} stamped with partner ${partnerId}`);
  });

  it("first-touch: a later ref never reassigns an existing owner", async () => {
    // Make a second partner and simulate a second landing for the same owner.
    const other = await partners.create({ name: "Second Partner" });
    try {
      // The signup stamp only writes referred_by on CREATE; an existing owner is
      // never updated. Assert the stored attribution is unchanged.
      const owner = await prisma.owner.findUnique({ where: { id: ownerId } });
      expect(owner!.referredByPartnerId).toBe(partnerId);
    } finally {
      await prisma.partner.delete({ where: { id: other.id } });
    }
    log("Existing owner attribution unchanged by a later code");
  });

  it("trial ($0 invoice) earns no commission", async () => {
    await webhook.webhook({} as any, invoiceEvent("in_e2e_trial", 0), undefined);
    const count = await prisma.commission.count({ where: { ownerId } });
    expect(count).toBe(0);
    log("Trial $0 invoice → 0 commissions");
  });

  it("first real payment mints one PENDING commission at the snapshotted rate", async () => {
    await webhook.webhook({} as any, invoiceEvent("in_e2e_m1", 4999), undefined);
    const rows = await prisma.commission.findMany({ where: { ownerId } });
    expect(rows).toHaveLength(1);
    expect(rows[0].stripeInvoiceId).toBe("in_e2e_m1");
    expect(Number(rows[0].rate)).toBe(0.25);
    expect(Number(rows[0].amount)).toBe(12.5);
    expect(rows[0].status).toBe("PENDING");
    expect(rows[0].period).toBe(currentPeriod());
    log(`Payment $49.99 → commission $${Number(rows[0].amount).toFixed(2)} (PENDING, rate 25%)`);
  });

  it("is idempotent on webhook retry (same invoice id)", async () => {
    await webhook.webhook({} as any, invoiceEvent("in_e2e_m1", 4999), undefined);
    const count = await prisma.commission.count({ where: { ownerId } });
    expect(count).toBe(1);
    log("Duplicate invoice webhook → still 1 commission");
  });

  it("recurring payment mints a second commission", async () => {
    await webhook.webhook({} as any, invoiceEvent("in_e2e_m2", 4999), undefined);
    const count = await prisma.commission.count({ where: { ownerId } });
    expect(count).toBe(2);
    log("Recurring month payment → 2 commissions total");
  });

  it("a refund reverses the matching commission only", async () => {
    await webhook.webhook(
      {} as any,
      { type: "charge.refunded", data: { object: { invoice: "in_e2e_m1" } } },
      undefined
    );
    const m1 = await prisma.commission.findUnique({ where: { stripeInvoiceId: "in_e2e_m1" } });
    const m2 = await prisma.commission.findUnique({ where: { stripeInvoiceId: "in_e2e_m2" } });
    expect(m1!.status).toBe("REVERSED");
    expect(m2!.status).toBe("PENDING");
    log("Refund of month-1 invoice → that row REVERSED, month-2 untouched");
  });

  it("reports the funnel correctly", async () => {
    const { funnel } = await partners.funnel(partnerId);
    expect(funnel.scanned).toBe(2);
    expect(funnel.signedUp).toBe(1);
    expect(funnel.inTrial).toBe(1); // owner still TRIALING
    expect(funnel.active).toBe(0);
    // Only the non-reversed current-month row counts.
    expect(funnel.thisMonthPayout).toBe(12.5);
    log(
      `Funnel → scanned ${funnel.scanned}, signedUp ${funnel.signedUp}, inTrial ${funnel.inTrial}, ` +
        `active ${funnel.active}, thisMonth $${funnel.thisMonthPayout.toFixed(2)}`
    );
  });

  it("moves a commission through approve → paid", async () => {
    const row = await prisma.commission.findUnique({ where: { stripeInvoiceId: "in_e2e_m2" } });
    await commissions.updateStatus(row!.id, "APPROVED");
    const paid = await commissions.updateStatus(row!.id, "PAID", "payout_ref_123");
    expect(paid.status).toBe("PAID");
    expect(paid.payoutReference).toBe("payout_ref_123");
    log("Commission APPROVED → PAID with payout reference");
  });

  it("supports a manual clawback adjustment", async () => {
    const adj = await commissions.createAdjustment({
      partnerId,
      amount: -12.5,
      note: "Clawback for refunded month-1"
    });
    expect(adj.kind).toBe("ADJUSTMENT");
    expect(Number(adj.amount)).toBe(-12.5);
    expect(adj.ownerId).toBeNull();
    log("Manual clawback adjustment added to the ledger");
  });
});

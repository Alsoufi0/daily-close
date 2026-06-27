import { Prisma } from "@prisma/client";
import { withDbRetry } from "./db-retry";

// Keep delays at 0ms so the suite runs instantly.
const NO_DELAY = { baseDelayMs: 0 };

function p1001() {
  return new Prisma.PrismaClientKnownRequestError("Can't reach database server", {
    code: "P1001",
    clientVersion: "test"
  });
}

describe("withDbRetry", () => {
  it("returns the result on first success without retrying", async () => {
    const fn = jest.fn().mockResolvedValue("ok");
    await expect(withDbRetry(fn, NO_DELAY)).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries a transient P1001 and succeeds on a later attempt", async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(p1001())
      .mockResolvedValue("recovered");
    await expect(withDbRetry(fn, NO_DELAY)).resolves.toBe("recovered");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("gives up after the configured attempts and rethrows the last error", async () => {
    const fn = jest.fn().mockRejectedValue(p1001());
    await expect(withDbRetry(fn, { attempts: 3, baseDelayMs: 0 })).rejects.toMatchObject({
      code: "P1001"
    });
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("does NOT retry non-connection errors (e.g. unique violation)", async () => {
    const unique = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
      code: "P2002",
      clientVersion: "test"
    });
    const fn = jest.fn().mockRejectedValue(unique);
    await expect(withDbRetry(fn, NO_DELAY)).rejects.toMatchObject({ code: "P2002" });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("does NOT retry plain errors", async () => {
    const fn = jest.fn().mockRejectedValue(new Error("boom"));
    await expect(withDbRetry(fn, NO_DELAY)).rejects.toThrow("boom");
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

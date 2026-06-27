import { Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";

const log = new Logger("DbRetry");

// Prisma error codes that mean "the database was momentarily unreachable",
// NOT "your query/data was wrong". Retrying these is safe and useful; retrying
// a P2002 (unique violation) or a logic error would just fail again.
//
//   P1001 — Can't reach database server (the one Sentry caught on the
//           missed-close cron: a brief Supabase pooler blip).
//   P1002 — Database server reached but timed out.
//   P1008 — Operation timed out.
//   P1017 — Server has closed the connection.
const RETRYABLE_PRISMA_CODES = new Set(["P1001", "P1002", "P1008", "P1017"]);

function isTransientConnectionError(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    return RETRYABLE_PRISMA_CODES.has(err.code);
  }
  // $connect itself failing surfaces as an initialization error (also code
  // P1001 underneath) — treat it the same.
  if (err instanceof Prisma.PrismaClientInitializationError) {
    return true;
  }
  return false;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Run a DB-touching operation, retrying ONLY on transient connection errors.
 *
 * Why this exists: the nightly cron endpoints (missed-close, weekly/monthly
 * summary) do all their work behind a single HTTP call. If the Supabase pooler
 * has a momentary hiccup at the instant the cron fires, the whole sweep throws
 * and is skipped until the next run — no alerts go out. A couple of spaced
 * retries turn a 1-2 second pooler blip into a non-event instead of a missed
 * night. (Sentry issue d68126d3: P1001 "Can't reach database server".)
 *
 * Safe for the cron because the work is idempotent: the missed-close sweep
 * dedups on an existing notification row before sending, so re-running after a
 * partial failure never double-sends. Only transient connection codes are
 * retried — real query/data errors throw immediately on the first attempt.
 */
export async function withDbRetry<T>(
  fn: () => Promise<T>,
  opts: { attempts?: number; baseDelayMs?: number; label?: string } = {}
): Promise<T> {
  const attempts = opts.attempts ?? 3;
  const baseDelayMs = opts.baseDelayMs ?? 2000;
  const label = opts.label ?? "operation";

  let lastErr: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isTransientConnectionError(err) || attempt === attempts) {
        throw err;
      }
      const delay = baseDelayMs * attempt; // linear backoff: 2s, then 4s
      const code = (err as { code?: string })?.code ?? "init-error";
      log.warn(
        `${label}: transient DB error ${code} on attempt ${attempt}/${attempts}; retrying in ${delay}ms`
      );
      await sleep(delay);
    }
  }
  // Unreachable (the loop either returns or throws), but satisfies the type.
  throw lastErr;
}

import AsyncStorage from "@react-native-async-storage/async-storage";
import { generateIdempotencyKey } from "./api";

/**
 * Offline-safe outbox queue for write operations (audit fix #5 phase 2).
 *
 * The problem: stores have flaky Wi-Fi. An employee finishes a close,
 * taps Submit, and the request hangs on a dead network — they're stuck.
 * Worse, the longer they wait, the more likely they retry, which without
 * idempotency would duplicate the close.
 *
 * The solution: every write that the app NEEDS to succeed (currently just
 * `finishClose`) gets enqueued here when the live request fails with a
 * network-class error. The queue persists in AsyncStorage so it survives
 * an app kill. It drains:
 *   - on app start (from App.tsx via drainOnStart)
 *   - on app foreground (App.tsx AppState listener)
 *   - phase 3: on network reconnect (NetInfo listener)
 *
 * Each queued operation carries the SAME idempotency key the original
 * attempt used, so when it finally lands the server treats it as the
 * original — never a duplicate.
 *
 * Backoff: exponential with jitter, capped at 5 minutes. Max attempts
 * 10 — after that the op is moved to a "dead" state for manual review
 * (not auto-purged so we never silently lose a close).
 */

const QUEUE_KEY = "dailyclose:outbox:v1";

export type OutboxOpType = "finishClose";

export interface OutboxOp {
  id: string;
  type: OutboxOpType;
  payload: unknown;
  attemptCount: number;
  nextAttemptAt: number; // ms epoch
  createdAt: number;
  lastError?: string;
  dead?: boolean; // exhausted retries
}

type Handler = (payload: unknown) => Promise<void>;
const handlers: Partial<Record<OutboxOpType, Handler>> = {};

const MAX_ATTEMPTS = 10;
const BACKOFF_BASE_MS = 2_000;
const BACKOFF_MAX_MS = 5 * 60_000;

export function registerHandler(type: OutboxOpType, handler: Handler) {
  handlers[type] = handler;
}

async function readQueue(): Promise<OutboxOp[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeQueue(ops: OutboxOp[]): Promise<void> {
  try {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(ops));
  } catch {
    /* persistence is best-effort */
  }
}

export async function enqueue(input: {
  type: OutboxOpType;
  payload: unknown;
}): Promise<OutboxOp> {
  const op: OutboxOp = {
    id: generateIdempotencyKey(),
    type: input.type,
    payload: input.payload,
    attemptCount: 0,
    nextAttemptAt: Date.now(),
    createdAt: Date.now()
  };
  const queue = await readQueue();
  queue.push(op);
  await writeQueue(queue);
  return op;
}

export async function getQueue(): Promise<OutboxOp[]> {
  return readQueue();
}

export async function pendingCount(): Promise<number> {
  const queue = await readQueue();
  return queue.filter((op) => !op.dead).length;
}

export async function clearAll(): Promise<void> {
  await AsyncStorage.removeItem(QUEUE_KEY);
}

export async function removeOp(id: string): Promise<void> {
  const queue = await readQueue();
  await writeQueue(queue.filter((op) => op.id !== id));
}

function nextBackoff(attemptCount: number): number {
  const exp = Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** attemptCount);
  // Add up to 30% jitter so multiple devices don't thunder-herd a server
  // after a regional outage.
  const jitter = exp * 0.3 * Math.random();
  return Math.floor(exp + jitter);
}

export interface DrainResult {
  attempted: number;
  succeeded: number;
  failed: number;
  remaining: number;
}

/**
 * Attempt to drain the queue once. Each ready op runs through its
 * registered handler. On success the op is removed; on failure it's
 * re-queued with bumped attemptCount + backoff. Dead ops are skipped.
 *
 * Safe to call any time — no-ops cleanly when the queue is empty or
 * no ops are ready (their nextAttemptAt is in the future).
 */
export async function drainOnce(): Promise<DrainResult> {
  const queue = await readQueue();
  const now = Date.now();
  let attempted = 0;
  let succeeded = 0;
  let failed = 0;
  const updated: OutboxOp[] = [];

  for (const op of queue) {
    if (op.dead || op.nextAttemptAt > now) {
      updated.push(op);
      continue;
    }
    const handler = handlers[op.type];
    if (!handler) {
      updated.push(op); // can't process — keep for next boot
      continue;
    }
    attempted += 1;
    try {
      await handler(op.payload);
      succeeded += 1;
      // op succeeded — drop from queue
    } catch (err: any) {
      failed += 1;
      const attemptCount = op.attemptCount + 1;
      const dead = attemptCount >= MAX_ATTEMPTS;
      updated.push({
        ...op,
        attemptCount,
        lastError: String(err?.message || err).slice(0, 200),
        nextAttemptAt: dead ? op.nextAttemptAt : Date.now() + nextBackoff(attemptCount),
        dead
      });
    }
  }

  await writeQueue(updated);
  const remaining = updated.filter((op) => !op.dead).length;
  return { attempted, succeeded, failed, remaining };
}

/** Marker error so callers can distinguish "queued for later" from a real failure. */
export class QueuedForRetryError extends Error {
  constructor(public readonly opId: string) {
    super("Submission queued — will send when online.");
    this.name = "QueuedForRetryError";
  }
}

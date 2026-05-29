const commonTimeZones = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Anchorage",
  "Pacific/Honolulu",
  "UTC",
  "Europe/London",
  "Europe/Bucharest",
  "Asia/Dubai",
  "Asia/Kolkata"
];

export function getBrowserTimeZone(defaultTimeZone = "America/New_York"): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || defaultTimeZone;
  } catch {
    return defaultTimeZone;
  }
}

export function getSupportedTimeZones(): string[] {
  try {
    const supportedValuesOf = (Intl as unknown as { supportedValuesOf?: (key: "timeZone") => string[] }).supportedValuesOf;
    const zones = typeof supportedValuesOf === "function"
      ? supportedValuesOf("timeZone")
      : [];
    return Array.from(new Set([...commonTimeZones, ...zones])).sort();
  } catch {
    return commonTimeZones;
  }
}

// ── Close business-date math (single source of truth) ─────────────────────────
//
// These functions decide which CALENDAR DATE a daily close belongs to, anchored
// to the STORE's timezone and close time — never the submitter's device. Both
// the web close flow and the mobile close flow import these so a close lands on
// the same business day regardless of where it's submitted from. Keeping one
// copy here is deliberate: earlier, web and mobile computed dates differently
// (mobile just sent the raw device instant), which filed late-night / cross-
// timezone closes under the wrong day.

export function parseCloseTime(closeTime?: string): number {
  const [hh, mm] = (closeTime || "23:30").split(":").map((part) => Number(part) || 0);
  return hh * 60 + mm;
}

function localParts(timezone?: string, date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone || "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value || 0);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    minutes: get("hour") * 60 + get("minute")
  };
}

function toLocalDateString(parts: { year: number; month: number; day: number }, dayOffset = 0): string {
  const d = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + dayOffset, 12, 0, 0));
  return d.toISOString().slice(0, 10);
}

// The store-local business date "right now" — accounting for late-night /
// overnight closes (e.g. a 23:30-close store closed at 00:20 still belongs to
// the previous business day).
export function suggestBusinessDate(store: { timezone?: string; closeTime?: string }, now = new Date()): string {
  const parts = localParts(store.timezone, now);
  const closeMin = parseCloseTime(store.closeTime);
  const overnight = parts.minutes < 6 * 60;
  const previousBusinessDay = overnight && (closeMin >= 6 * 60 || parts.minutes >= closeMin);
  return toLocalDateString(parts, previousBusinessDay ? -1 : 0);
}

// Whether the UI should ask the user to confirm/adjust the business date
// (ambiguous window before close time, or the suggestion differs from "today").
export function shouldConfirmBusinessDate(
  store: { timezone?: string; closeTime?: string },
  suggestedDate: string,
  now = new Date()
): boolean {
  const parts = localParts(store.timezone, now);
  const closeMin = parseCloseTime(store.closeTime);
  const today = toLocalDateString(parts);
  const earlyBeforeClose = parts.minutes < closeMin && !(closeMin < 6 * 60 && parts.minutes < 6 * 60);
  return earlyBeforeClose || suggestedDate !== today;
}

function timezoneOffsetMinutes(timezone: string, date: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
  const parts = dtf.formatToParts(date);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value || 0);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - date.getTime()) / 60000);
}

// Convert a store-local calendar date (YYYY-MM-DD) into the UTC instant of NOON
// in that store's timezone. Anchoring to noon (rather than midnight) keeps the
// stored instant safely inside the intended local day for every timezone, so
// the server's day-range math attributes it unambiguously.
export function storeLocalDateToUtcNoon(date: string, timezone = "America/New_York"): string {
  const [year, month, day] = date.split("-").map((part) => Number(part));
  const guess = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const offset = timezoneOffsetMinutes(timezone, guess);
  return new Date(guess.getTime() - offset * 60_000).toISOString();
}

// Format an absolute instant as a YYYY-MM-DD calendar date in a store's
// timezone. Used to display close dates by the store's clock instead of UTC.
export function formatDateInTimeZone(date: Date, timezone = "America/New_York"): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

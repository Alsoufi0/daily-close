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

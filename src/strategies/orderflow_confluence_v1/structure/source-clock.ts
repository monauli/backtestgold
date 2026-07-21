import type { SourceClockEncoding } from "./types";
export function sourceClockToAbsolute(timestamp: number, timeZone: string, encoding: SourceClockEncoding = "wall_clock_encoded_as_utc"): number {
  if (encoding !== "wall_clock_encoded_as_utc") return timestamp;
  const d = new Date(timestamp); const wall = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds(), d.getUTCMilliseconds());
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset", hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(new Date(wall));
  const zone = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT"; const m = zone.match(/GMT([+-])(\d{2}):?(\d{2})?/); const offset = m ? (Number(m[2]) * 60 + Number(m[3] ?? 0)) * 60000 * (m[1] === "+" ? 1 : -1) : 0;
  return wall - offset;
}
export function absoluteToSourceClock(timestamp: number, timeZone: string, encoding: SourceClockEncoding = "wall_clock_encoded_as_utc"): number {
  if (encoding !== "wall_clock_encoded_as_utc") return timestamp;
  const p = new Intl.DateTimeFormat("en-CA", { timeZone, hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(new Date(timestamp)); const get = (x: string) => Number(p.find((z) => z.type === x)?.value ?? 0);
  return Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
}
export function sourceClockDateKey(timestamp: number, timeZone: string, encoding: SourceClockEncoding = "wall_clock_encoded_as_utc"): string { return new Date(absoluteToSourceClock(timestamp, timeZone, encoding)).toISOString().slice(0, 10); }

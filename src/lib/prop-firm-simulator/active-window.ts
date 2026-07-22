import { sourceClockToAbsolute } from "@/strategies/orderflow_confluence_v1/structure/source-clock";

export const ACTIVE_WINDOW_TIME_ZONE = "Asia/Jakarta";
export const SOURCE_CLOCK_TIME_ZONE = "Europe/Helsinki";

export function jakartaEntryHour(sourceWallClockTimestamp: number) {
  const instant = sourceClockToAbsolute(sourceWallClockTimestamp, SOURCE_CLOCK_TIME_ZONE);
  return Number(new Intl.DateTimeFormat("en-US", { timeZone: ACTIVE_WINDOW_TIME_ZONE, hour: "2-digit", hourCycle: "h23" }).format(new Date(instant)));
}
export function isActiveWindowEntry(sourceWallClockTimestamp: number) { return jakartaEntryHour(sourceWallClockTimestamp) >= 7; }

import { describe, expect, it } from "vitest";
import { DEFAULT_STRUCTURE_CONFIG, absoluteToSourceClock, analyzeMarketEvents, calculateDailyLevels, calculateProxyVwap, calculateWeeklyLevels, detectMarketEvents, sourceClockToAbsolute } from "@/strategies/orderflow_confluence_v1/structure";
import { buildSessionMetrics, sessionOverlap } from "@/strategies/orderflow_confluence_v1/structure/sessions";
import type { Candle } from "@/backtest/types";

const c = (label: string, open: number, high: number, low: number, close: number, volume?: number): Candle => ({ timestamp: Date.parse(`${label}Z`), open, high, low, close, ...(volume === undefined ? {} : { volume }) });
const cfg = DEFAULT_STRUCTURE_CONFIG;

describe("orderflow structure layer", () => {
  it("converts Helsinki wall-clock with DST and preserves source timestamp", () => {
    const summer = Date.parse("2024-07-01T12:00:00Z");
    const winter = Date.parse("2024-01-01T12:00:00Z");
    expect(sourceClockToAbsolute(summer, "Europe/Helsinki")).toBe(Date.parse("2024-07-01T09:00:00Z"));
    expect(sourceClockToAbsolute(winter, "Europe/Helsinki")).toBe(Date.parse("2024-01-01T10:00:00Z"));
    expect(absoluteToSourceClock(sourceClockToAbsolute(summer, "Europe/Helsinki"), "Europe/Helsinki")).toBe(summer);
  });
  it("builds Asia, London and New York sessions without future candles", () => {
    const candles = [c("2024-01-02T10:00:00", 1, 2, 0.5, 1.5), c("2024-01-02T11:00:00", 1.5, 3, 1, 2), c("2024-01-02T15:00:00", 2, 4, 1.5, 3)];
    const london = buildSessionMetrics(candles, "LONDON", cfg);
    expect(london[0].high).toBe(4); expect(london[0].status).toBe("COMPLETED"); expect(london[0].candleCount).toBe(3);
    expect(sessionOverlap(cfg.sessions.LONDON, cfg.sessions.NEW_YORK, Date.parse("2024-01-02T12:00:00Z"))).not.toBeNull();
  });
  it("derives daily levels only from prior D1 and records knownAt", () => {
    const result = calculateDailyLevels([c("2024-01-01T00:00:00", 10, 12, 9, 11), c("2024-01-02T00:00:00", 11, 14, 10, 13)], cfg);
    expect(result[1].previousDayHigh?.price).toBe(12); expect(result[1].previousDayLow?.price).toBe(9); expect(result[1].dailyOpen?.price).toBe(11); expect(result[1].previousDayHigh!.knownAt).toBe(sourceClockToAbsolute(Date.parse("2024-01-02T00:00:00Z"), cfg.brokerTimeZone));
  });
  it("uses Sunday source-clock boundary for weekly levels", () => {
    const result = calculateWeeklyLevels([c("2024-01-07T00:00:00", 10, 12, 9, 11), c("2024-01-08T00:00:00", 11, 14, 10, 13), c("2024-01-14T00:00:00", 13, 15, 12, 14)], cfg);
    expect(result[1].weekStart).toBe("2024-01-14"); expect(result[1].previousWeekHigh?.price).toBe(14); expect(result[1].weeklyOpen?.price).toBe(13);
  });
  it("calculates proxy_vwap, bands and daily reset with zero/missing volume", () => {
    const result = calculateProxyVwap([c("2024-01-02T00:00:00", 1, 3, 1, 2, 10), c("2024-01-02T00:01:00", 2, 4, 2, 3, 0), c("2024-01-02T00:02:00", 3, 5, 3, 4), c("2024-01-03T00:00:00", 10, 12, 10, 11, 5)], cfg);
    expect(result[0].name).toBe("proxy_vwap"); expect(result[0].vwap).toBe(2); expect(result[0].weightedVariance).toBeCloseTo(0); expect(result[2].warningCount).toBe(1); expect(result[2].cumulativeTickVolume).toBe(5);
  });
  it("rejects reclaim without a prior sweep", () => expect(detectMarketEvents([c("2024-01-02T00:00:00", 10, 11, 9.2, 10.2)], [{ levelType: "PREVIOUS_DAY_LOW", price: 9, direction: "SUPPORT" }], cfg).some((x) => x.type === "BULLISH_RECLAIM")).toBe(false));
  it("links bullish and bearish reclaim to their respective sweep", () => {
    const bullish = detectMarketEvents([c("2024-01-02T00:00:00", 10, 10.5, 8.5, 9), c("2024-01-02T00:01:00", 9, 10.5, 9, 10.2)], [{ levelType: "PREVIOUS_DAY_LOW", price: 9, direction: "SUPPORT" }], cfg);
    const bearish = detectMarketEvents([c("2024-01-02T00:00:00", 10, 11.5, 9.5, 11), c("2024-01-02T00:01:00", 11, 11, 9.8, 9.7)], [{ levelType: "PREVIOUS_DAY_HIGH", price: 11, direction: "RESISTANCE" }], cfg);
    expect(bullish.find((x) => x.type === "BULLISH_RECLAIM")?.parentEventId).toBe(bullish.find((x) => x.type === "SUPPORT_SWEEP")?.eventId); expect(bearish.find((x) => x.type === "BEARISH_RECLAIM")?.parentEventId).toBe(bearish.find((x) => x.type === "RESISTANCE_SWEEP")?.eventId);
  });
  it("expires sweep, deduplicates breakout, and links failed breakout", () => {
    const short = { ...cfg, marketEvents: { ...cfg.marketEvents, maximumReclaimBars: 1, eventExpiryBars: 1 } };
    const expired = analyzeMarketEvents([c("2024-01-02T00:00:00", 10, 10, 8, 8.5), c("2024-01-02T00:01:00", 8.5, 8.8, 8.4, 8.6), c("2024-01-02T00:02:00", 8.5, 10, 8.5, 10.2)], [{ levelType: "PREVIOUS_DAY_LOW", price: 9, direction: "SUPPORT" }], short);
    expect(expired.events.some((x) => x.type === "BULLISH_RECLAIM")).toBe(false); expect(expired.expiredEvents).toBeGreaterThan(0);
    const events = detectMarketEvents([c("2024-01-02T00:00:00", 10, 10, 8, 8.5), c("2024-01-02T00:01:00", 8.5, 8.8, 8, 8.4), c("2024-01-02T00:02:00", 8.4, 9.5, 8.4, 9.2), c("2024-01-02T00:03:00", 9.2, 9.2, 8, 8.5)], [{ levelType: "PREVIOUS_DAY_LOW", price: 9, direction: "SUPPORT" }], cfg);
    expect(events.filter((x) => x.type === "BEARISH_BREAKOUT")).toHaveLength(2); const failed = events.find((x) => x.type === "FAILED_BREAKOUT"); expect(failed?.parentEventId).toBeTruthy(); expect(events.some((x) => x.eventId === failed?.parentEventId)).toBe(true);
  });
  it("keeps rejection standalone and knownAt safe", () => { const a = analyzeMarketEvents([c("2024-01-02T00:00:00", 10, 10.2, 8, 9.1)], [{ levelType: "PREVIOUS_DAY_LOW", price: 9, direction: "SUPPORT", knownAt: Date.parse("2024-01-02T00:00:00Z") }], cfg, Date.parse("2024-01-02T00:00:00Z")); expect(a.events.some((x) => x.type === "REJECTION")).toBe(true); expect(a.events.filter((x) => x.type.endsWith("RECLAIM")).length).toBe(0); expect(a.invariantViolations).toBe(0); });
});

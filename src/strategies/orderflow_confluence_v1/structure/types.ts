import type { Candle } from "@/backtest/types";

export type SourceClockEncoding = "wall_clock_encoded_as_utc";
export type SessionName = "ASIA" | "LONDON" | "NEW_YORK";
export type LevelType = "ASIA_HIGH" | "ASIA_LOW" | "ASIA_MIDPOINT" | "LONDON_HIGH" | "LONDON_LOW" | "LONDON_MIDPOINT" | "NEW_YORK_HIGH" | "NEW_YORK_LOW" | "NEW_YORK_MIDPOINT" | "PREVIOUS_DAY_HIGH" | "PREVIOUS_DAY_LOW" | "DAILY_OPEN" | "PREVIOUS_WEEK_HIGH" | "PREVIOUS_WEEK_LOW" | "PREVIOUS_WEEK_OPEN" | "PREVIOUS_WEEK_CLOSE" | "WEEKLY_OPEN" | "PROXY_VWAP" | "PROXY_VWAP_UPPER_1" | "PROXY_VWAP_LOWER_1" | "PROXY_VWAP_UPPER_2" | "PROXY_VWAP_LOWER_2";
export type MarketEventType = "SUPPORT_SWEEP" | "RESISTANCE_SWEEP" | "BULLISH_RECLAIM" | "BEARISH_RECLAIM" | "BULLISH_BREAKOUT" | "BEARISH_BREAKOUT" | "REJECTION" | "FAILED_BREAKOUT";
export type Direction = "BULLISH" | "BEARISH";

export type SessionConfig = { name: SessionName; timeZone: string; start: string; end: string };
export type StructureConfig = { brokerTimeZone: string; sourceClockEncoding: SourceClockEncoding; sessions: Record<SessionName, SessionConfig>; marketEvents: { minimumSweepDistance: number; breakoutBuffer: number; maximumReclaimBars: number; rejectionWickRatio: number; minimumCloseDistance: number; eventExpiryBars: number } };
export type AbsoluteCandle = Candle & { absoluteTimestamp: number };
export type SessionMetrics = { name: SessionName; startTime: number; endTime: number; open: number; high: number; low: number; close: number; midpoint: number; range: number; candleCount: number; status: "FORMING" | "COMPLETED" };
export type LevelValue = { levelType: LevelType; price: number | null; knownAt: number; source: "D1" | "M1" | "SESSION" | "PROXY_TICK_VOLUME" };
export type DailyLevels = { date: string; previousDayHigh: LevelValue | null; previousDayLow: LevelValue | null; previousDayOpen: LevelValue | null; previousDayClose: LevelValue | null; dailyOpen: LevelValue | null };
export type WeeklyLevels = { weekStart: string; previousWeekHigh: LevelValue | null; previousWeekLow: LevelValue | null; previousWeekOpen: LevelValue | null; previousWeekClose: LevelValue | null; weeklyOpen: LevelValue | null };
export type ProxyVwapSnapshot = { name: "proxy_vwap"; timestamp: number; vwap: number | null; weightedVariance: number | null; upper1: number | null; lower1: number | null; upper2: number | null; lower2: number | null; cumulativeTickVolume: number; candleCount: number; warningCount: number };
export type MarketEvent = { eventId: string; parentEventId: string | null; type: MarketEventType; direction: Direction; timestamp: number; sourceCandleTimestamp: number; levelType: LevelType; levelPrice: number; sweepExtreme: number | null; distance: number; detectedAt: number; confirmationTimestamp: number | null; knownAt: number; expiryTimestamp: number; sourceSession: SessionName | null; metadata: Record<string, number | string | boolean | null> };

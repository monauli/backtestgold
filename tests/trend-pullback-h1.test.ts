import { describe, expect, it } from "vitest";
import type { Candle } from "@/backtest/types";
import { calculateH1Indicators, MIN_WARMUP_CANDLES, hasH1Warmup } from "@/strategies/xau_trend_pullback_h1/indicators";
import { DEFAULT_XAU_TREND_PULLBACK_H1_CONFIG } from "@/strategies/xau_trend_pullback_h1/config";
import { bearishConfirmation, bullishConfirmation, latestSwing, makeSignal, pullbackValid, runTrendPullbackH1 } from "@/strategies/xau_trend_pullback_h1/engine";

const candle = (i: number, open: number, high: number, low: number, close: number): Candle => ({ timestamp: Date.UTC(2024, 0, 1, i), open, high, low, close });
const cfg = { ...DEFAULT_XAU_TREND_PULLBACK_H1_CONFIG };

describe("XAU Trend Pullback H1 indicators", () => {
  it("calculates EMA50/EMA200 from closed H1 closes with SMA seed", () => {
    const candles = Array.from({ length: 205 }, (_, i) => candle(i, 100, 101, 99, 100));
    const points = calculateH1Indicators(candles);
    expect(points[49].ema50).toBeCloseTo(100); expect(points[199].ema200).toBeCloseTo(100); expect(points[204].ema50).toBeCloseTo(100); expect(points[204].ema200).toBeCloseTo(100);
  });
  it("calculates ATR14 using TR and Wilder smoothing", () => {
    const candles = Array.from({ length: 20 }, (_, i) => candle(i, 100, 110, 100, 105));
    const point = calculateH1Indicators(candles)[19];
    expect(point.atr14).toBe(10);
  });
  it("requires 204 warm-up candles before a signal index", () => {
    expect(MIN_WARMUP_CANDLES).toBe(204); expect(hasH1Warmup(new Array(204).fill(candle(0, 1, 2, 0, 1)), 203)).toBe(false); expect(hasH1Warmup(new Array(205).fill(candle(0, 1, 2, 0, 1)), 204)).toBe(true);
  });
  it("uses only the supplied closed prefix", () => {
    const base = Array.from({ length: 205 }, (_, i) => candle(i, 100, 101, 99, 100)); const changedFuture = [...base, candle(205, 1000, 1100, 900, 1050)];
    expect(calculateH1Indicators(base)[204]).toEqual(calculateH1Indicators(changedFuture)[204]);
  });
});

describe("XAU Trend Pullback H1 signals", () => {
  it("uses the first 204 candles as warm-up when the period starts at dataset candle one", () => {
    const candles = Array.from({ length: 206 }, (_, i) => candle(i, 100, 101, 99, 100));
    const engine = runTrendPullbackH1(candles, { ...cfg, startDate: "2024-01-01", endDate: "2024-01-09" }, candles[0].timestamp, candles[205].timestamp);
    expect(engine.warmupCandlesUsed).toBe(204);
    expect(engine.effectiveTradingStart).toBe(new Date(candles[204].timestamp).toISOString());
    expect(engine.trades).toHaveLength(0);
  });
  it("does not allow a signal during the first 204 candles and starts evaluation on candle 205", () => {
    const candles = Array.from({ length: 205 }, (_, i) => candle(i, 100, 101, 99, 100));
    const engine = runTrendPullbackH1(candles, { ...cfg, startDate: "2024-01-01", endDate: "2024-01-09" }, candles[0].timestamp, candles[204].timestamp);
    expect(engine.effectiveTradingStart).toBe(new Date(candles[204].timestamp).toISOString());
    expect(engine.trades).toHaveLength(0);
  });
  it("fails only when the selected period has fewer than 205 H1 candles", () => {
    const candles = Array.from({ length: 204 }, (_, i) => candle(i, 100, 101, 99, 100));
    expect(() => runTrendPullbackH1(candles, { ...cfg, startDate: "2024-01-01", endDate: "2024-01-09" }, candles[0].timestamp, candles[203].timestamp)).toThrow("INSUFFICIENT_H1_WARMUP");
  });
  it("accepts canonical bullish/bearish confirmation definitions", () => {
    const candles = [candle(0, 100, 105, 99, 104), candle(1, 104, 106, 103, 105.8)]; const points = [{ ema50: 100, ema200: 90, atr14: 10 }, { ema50: 101, ema200: 90, atr14: 10 }];
    expect(bullishConfirmation(candles, points, 1, cfg)).toBe(true); expect(bearishConfirmation([candle(0, 100, 101, 95, 96), candle(1, 96, 97, 93, 93.2)], points, 1, cfg)).toBe(false);
  });
  it("validates pullback only inside EMA50 ± 0.25 ATR", () => {
    const candles = [candle(0, 100, 105, 99, 103), candle(1, 103, 104, 101, 102), candle(2, 102, 103, 100, 102), candle(3, 102, 110, 101, 109)]; const points = candles.map(() => ({ ema50: 100, ema200: 90, atr14: 4 }));
    expect(pullbackValid(candles, points, 3, cfg)).toBe(true); const far = candles.map((x) => ({ ...x, low: x.low + 10, high: x.high + 10 })); expect(pullbackValid(far, points, 3, cfg)).toBe(false);
  });
  it("uses only confirmed five-candle swings in the ten-candle lookback", () => {
    const candles = Array.from({ length: 20 }, (_, i) => candle(i, 100, 110, 90, 100)); candles[12] = candle(12, 100, 110, 80, 100); candles[10] = candle(10, 100, 120, 90, 100);
    expect(latestSwing(candles, 15, "BUY", cfg)).toBe(80); expect(latestSwing(candles, 15, "SELL", cfg)).toBe(120);
  });
  it("does not create a signal without trend separation or next candle", () => {
    const candles = Array.from({ length: 205 }, (_, i) => candle(i, 100, 101, 99, 100)); const points = calculateH1Indicators(candles);
    expect(makeSignal(candles, points, 204, cfg)).toBe(null);
  });
});

import { describe, expect, it } from "vitest";
import type { Candle } from "@/backtest/types";
import { buildH4EmaTrendFilter, calculateClosedEma } from "@/strategies/breakout_h4_ema_trend";

const c = (i: number, close: number): Candle => ({ timestamp: Date.UTC(2024, 0, 1, i * 4), open: close, high: close + 1, low: close - 1, close });

describe("Breakout H4 EMA trend filter", () => {
  it("calculates EMA50 and EMA200 with a closed-candle SMA seed", () => {
    const values = new Array(205).fill(100); const ema50 = calculateClosedEma(values, 50); const ema200 = calculateClosedEma(values, 200);
    expect(ema50[48]).toBe(null); expect(ema50[49]).toBeCloseTo(100); expect(ema200[198]).toBe(null); expect(ema200[199]).toBeCloseTo(100);
  });
  it("requires 204 closed H4 warm-up candles", () => {
    expect(() => buildH4EmaTrendFilter(new Array(205).fill(0).map((_, i) => c(i, 100)), Date.UTC(2024, 0, 1, 204 * 4))).not.toThrow();
    expect(() => buildH4EmaTrendFilter(new Array(204).fill(0).map((_, i) => c(i, 100)), Date.UTC(2024, 0, 1, 204 * 4))).toThrow("INSUFFICIENT_H4_EMA_WARMUP");
  });
  it("accepts BUY only when EMA50 is above EMA200", () => {
    const up = [...new Array(204).fill(100), ...new Array(20).fill(110)].map((v, i) => c(i, v)); const down = [...new Array(204).fill(100), ...new Array(20).fill(90)].map((v, i) => c(i, v));
    const upFilter = buildH4EmaTrendFilter(up, up[204].timestamp); const downFilter = buildH4EmaTrendFilter(down, down[204].timestamp);
    expect(upFilter.filter("BUY", up[204])).toBe(true); expect(upFilter.filter("SELL", up[204])).toBe(false); expect(downFilter.filter("BUY", down[204])).toBe(false);
  });
  it("accepts SELL only when EMA50 is below EMA200 and rejects equality", () => {
    const down = [...new Array(204).fill(100), ...new Array(100).fill(90)].map((v, i) => c(i, v)); const flat = new Array(224).fill(0).map((v, i) => c(i, v));
    const downFilter = buildH4EmaTrendFilter(down, down[204].timestamp); const flatFilter = buildH4EmaTrendFilter(flat, flat[204].timestamp);
    expect(downFilter.filter("SELL", down[303])).toBe(true); expect(downFilter.filter("BUY", down[303])).toBe(false); expect(flatFilter.filter("BUY", flat[204])).toBe(false); expect(flatFilter.filter("SELL", flat[204])).toBe(false);
  });
  it("does not use a running or future candle", () => {
    const base = [...new Array(204).fill(100), ...new Array(20).fill(110)].map((v, i) => c(i, v)); const future = [...base, c(224, 1000), c(225, 1)];
    const a = buildH4EmaTrendFilter(base, base[204].timestamp); const b = buildH4EmaTrendFilter(future, future[204].timestamp);
    expect(b.points[204]).toEqual(a.points[204]); expect(b.filter("BUY", future[204])).toBe(a.filter("BUY", base[204]));
  });
});

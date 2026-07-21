import type { Candle } from "@/backtest/types";
import { BREAKOUT_H4_EMA_TREND_WARMUP } from "./config";

export type H4EmaPoint = { timestamp: number; ema50: number | null; ema200: number | null };

export function calculateClosedEma(values: number[], period: number): Array<number | null> {
  const result: Array<number | null> = Array(values.length).fill(null);
  if (values.length < period) return result;
  let value = values.slice(0, period).reduce((sum, x) => sum + x, 0) / period;
  result[period - 1] = value;
  const alpha = 2 / (period + 1);
  for (let i = period; i < values.length; i++) { value = alpha * values[i] + (1 - alpha) * value; result[i] = value; }
  return result;
}

export function buildH4EmaTrendFilter(candles: Candle[], firstTradingTimestamp: number, warmup = BREAKOUT_H4_EMA_TREND_WARMUP) {
  const firstTradingIndex = candles.findIndex(c => c.timestamp >= firstTradingTimestamp);
  if (firstTradingIndex < 0 || firstTradingIndex < warmup) throw new Error("INSUFFICIENT_H4_EMA_WARMUP");
  const closes = candles.map(c => c.close); const ema50 = calculateClosedEma(closes, 50); const ema200 = calculateClosedEma(closes, 200);
  const points: H4EmaPoint[] = candles.map((c, i) => ({ timestamp: c.timestamp, ema50: ema50[i], ema200: ema200[i] }));
  const byTimestamp = new Map(points.map(p => [p.timestamp, p]));
  return { warmupCandlesUsed: firstTradingIndex, points, filter: (direction: "BUY" | "SELL", referenceCandle: Candle) => { const point = byTimestamp.get(referenceCandle.timestamp); if (!point || point.ema50 === null || point.ema200 === null) return false; return direction === "BUY" ? point.ema50 > point.ema200 : point.ema50 < point.ema200; } };
}

import type { Candle } from "@/backtest/types";
import type { H1IndicatorPoint } from "./types";

export const EMA_FAST_PERIOD = 50;
export const EMA_SLOW_PERIOD = 200;
export const ATR_PERIOD = 14;
export const MIN_WARMUP_CANDLES = 204;

function sma(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function calculateH1Indicators(
  candles: Candle[],
  emaFastPeriod = EMA_FAST_PERIOD,
  emaSlowPeriod = EMA_SLOW_PERIOD,
  atrPeriod = ATR_PERIOD,
): H1IndicatorPoint[] {
  const result: H1IndicatorPoint[] = candles.map(() => ({ ema50: null, ema200: null, atr14: null }));
  if (candles.length === 0) return result;
  const fastAlpha = 2 / (emaFastPeriod + 1);
  const slowAlpha = 2 / (emaSlowPeriod + 1);
  let emaFast: number | null = null;
  let emaSlow: number | null = null;
  let atr: number | null = null;
  const trs: number[] = [];

  for (let i = 0; i < candles.length; i++) {
    const candle = candles[i];
    if (i >= emaFastPeriod - 1) {
      emaFast = emaFast === null ? sma(candles.slice(i - emaFastPeriod + 1, i + 1).map((x) => x.close)) : fastAlpha * candle.close + (1 - fastAlpha) * emaFast;
    }
    if (i >= emaSlowPeriod - 1) {
      emaSlow = emaSlow === null ? sma(candles.slice(i - emaSlowPeriod + 1, i + 1).map((x) => x.close)) : slowAlpha * candle.close + (1 - slowAlpha) * emaSlow;
    }
    if (i > 0) {
      const previousClose = candles[i - 1].close;
      trs.push(Math.max(candle.high - candle.low, Math.abs(candle.high - previousClose), Math.abs(candle.low - previousClose)));
      if (trs.length >= atrPeriod) {
        const seedIndex = trs.length - atrPeriod;
        atr = atr === null ? sma(trs.slice(seedIndex, seedIndex + atrPeriod)) : ((atr * (atrPeriod - 1)) + trs[trs.length - 1]) / atrPeriod;
      }
    }
    result[i] = { ema50: emaFast, ema200: emaSlow, atr14: atr };
  }
  return result;
}

export function hasH1Warmup(candles: Candle[], startIndex: number): boolean {
  return startIndex >= MIN_WARMUP_CANDLES && candles.length > startIndex;
}

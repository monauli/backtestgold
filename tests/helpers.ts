import type { Candle, EngineParams } from "@/backtest/types";
import { getMethod, pipsToPrice } from "@/backtest/methods";
import { BreakoutEngine } from "@/backtest/engine";

export const H4 = 4 * 3600_000;
export const M1 = 60_000;
export const T0 = Date.UTC(2024, 0, 2, 0, 0, 0); // Tue 2024-01-02 00:00

export function c(
  timestamp: number,
  open: number,
  high: number,
  low: number,
  close: number
): Candle {
  return { timestamp, open, high, low, close };
}

/** RULE_A engine params (breakout 100 pip, SL 200 pip, TP 400 pip), lot 0.4. */
export const params = (over: Partial<EngineParams> = {}): EngineParams => {
  const m = getMethod("RULE_A");
  return {
    breakoutDistance: pipsToPrice(m.breakoutPips),
    stopLossDistance: pipsToPrice(m.stopLossPips),
    takeProfitDistance: pipsToPrice(m.takeProfitPips),
    lot: 0.4,
    initialBalance: 10000,
    spread: 0,
    slippage: 0,
    commission: 0,
    session: "ALL",
    ambiguousHandling: "SKIP",
    ...over,
  };
};

/**
 * Standard fixture: previous H4 candle high=2000, low=1990 →
 * buy level 2010, sell level 1980 (breakout 100 pip = 10.00 price).
 */
export function makeH4(): Candle[] {
  return [
    c(T0, 1995, 2000, 1990, 1998), // reference candle
    c(T0 + H4, 1998, 1999, 1997, 1998), // active period
    c(T0 + 2 * H4, 1998, 1999, 1997, 1998),
  ];
}

export function run(
  h4: Candle[],
  m1: Candle[],
  over: Partial<EngineParams> = {}
): BreakoutEngine {
  const engine = new BreakoutEngine(h4, params(over));
  for (const candle of m1) engine.onM1(candle);
  engine.finish();
  return engine;
}

import type { BacktestRequest, Candle } from "@/backtest/types";
import { DEFAULT_XAU_TREND_PULLBACK_H1_CONFIG } from "./config";
import { runTrendPullbackH1 } from "./engine";
import type { XauTrendPullbackH1Config } from "./types";

export function trendPullbackH1Config(req: BacktestRequest): XauTrendPullbackH1Config {
  return {
    ...DEFAULT_XAU_TREND_PULLBACK_H1_CONFIG,
    strategyId: "xau_trend_pullback_h1",
    strategyName: "XAU Trend Pullback H1",
    startDate: req.startDate,
    endDate: req.endDate,
    lot: req.lot,
    initialBalance: req.initialBalance,
    riskReward: 2,
    emaFastPeriod: 50,
    emaSlowPeriod: 200,
    atrPeriod: 14,
    warmupCandles: 204,
  };
}

export function runTrendPullbackH1Request(req: BacktestRequest, candles: Candle[]) {
  const cfg = trendPullbackH1Config(req);
  const fromMs = Date.parse(`${req.startDate}T00:00:00.000Z`);
  const toMs = Date.parse(`${req.endDate}T23:59:59.999Z`);
  return { cfg, engine: runTrendPullbackH1(candles, cfg, fromMs, toMs) };
}

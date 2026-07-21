import type { XauTrendPullbackH1Config } from "./types";

export const XAU_TREND_PULLBACK_H1_ID = "xau_trend_pullback_h1" as const;
export const XAU_TREND_PULLBACK_H1_NAME = "XAU Trend Pullback H1" as const;
export const DEFAULT_XAU_TREND_PULLBACK_H1_CONFIG: XauTrendPullbackH1Config = {
  strategyId: XAU_TREND_PULLBACK_H1_ID, strategyName: XAU_TREND_PULLBACK_H1_NAME,
  startDate: "", endDate: "", lot: 0.35, initialBalance: 10000, riskReward: 2,
  emaFastPeriod: 50, emaSlowPeriod: 200, atrPeriod: 14, warmupCandles: 204,
  pullbackAtrTolerance: 0.25, trendAtrSeparation: 0.5, swingLookback: 10,
  swingFractalRadius: 2, swingBufferAtr: 0.1, stopAtrMultiple: 1.5,
  confirmationBodyMin: 0.5, confirmationCloseTopFraction: 0.75,
  maxTradesPerDay: 2, maxLossesPerDay: 2,
};

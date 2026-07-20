import type { XauTrendPullbackH1Config } from "./types";

export const XAU_TREND_PULLBACK_H1_ID = "xau_trend_pullback_h1" as const;
export const XAU_TREND_PULLBACK_H1_NAME = "XAU Trend Pullback H1";
export const DEFAULT_XAU_TREND_PULLBACK_H1_CONFIG: XauTrendPullbackH1Config = {
  strategyId: XAU_TREND_PULLBACK_H1_ID,
  startDate: "", endDate: "", lot: 0.4, initialBalance: 10000,
};

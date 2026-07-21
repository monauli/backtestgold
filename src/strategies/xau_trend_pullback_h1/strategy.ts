import type { StrategyDefinition } from "@/strategies/types";
import { XAU_TREND_PULLBACK_H1_ID, XAU_TREND_PULLBACK_H1_NAME } from "./config";
import { validateXauTrendPullbackH1Config } from "./validator";

export const xauTrendPullbackH1Strategy: StrategyDefinition = {
  id: XAU_TREND_PULLBACK_H1_ID,
  name: XAU_TREND_PULLBACK_H1_NAME,
  description: "Strategi trend dan pullback XAUUSD menggunakan timeframe H1.",
  status: "DRAFT",
  signalTimeframe: "H1",
  executionTimeframe: "H1",
  validateConfig: validateXauTrendPullbackH1Config,
};

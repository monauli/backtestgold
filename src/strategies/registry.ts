import type { StrategyDefinition } from "./types";
import { xauTrendPullbackH1Strategy } from "./xau_trend_pullback_h1";
import { BREAKOUT_METHOD_NAME } from "@/backtest/methods";
import { breakoutH4EmaTrendStrategy } from "./breakout_h4_ema_trend";
import { breakoutH4StopAfter1LossStrategy } from "./breakout_h4_stop_after_1_loss";
import { dailyPreviousCandleBreakoutStrategy } from "./daily_previous_candle_breakout";
import { orderflowConfluenceV1Strategy } from "./orderflow_confluence_v1";

export const BREAKOUT_H4_STRATEGY_ID = "xau_h4_breakout";
export const XAU_TREND_PULLBACK_H1_STRATEGY_ID = "xau_trend_pullback_h1";
export const strategyRegistry: StrategyDefinition[] = [
  { id: BREAKOUT_H4_STRATEGY_ID, name: BREAKOUT_METHOD_NAME, description: "H4 XAUUSD breakout strategy.", status: "READY", signalTimeframe: "H4", executionTimeframe: "M1", validateConfig: () => ({ valid: true, errors: [] }) },
  breakoutH4EmaTrendStrategy,
  breakoutH4StopAfter1LossStrategy,
  dailyPreviousCandleBreakoutStrategy,
  orderflowConfluenceV1Strategy,
  { ...xauTrendPullbackH1Strategy, status: "READY", executionTimeframe: "H1" },
];
export function getStrategy(id: string): StrategyDefinition | undefined { return strategyRegistry.find((s) => s.id === id); }

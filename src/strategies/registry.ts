import type { StrategyDefinition } from "./types";
import { xauTrendPullbackH1Strategy } from "./xau_trend_pullback_h1";
import { BREAKOUT_METHOD_NAME } from "@/backtest/methods";

export const BREAKOUT_H4_STRATEGY_ID = "xau_h4_breakout";
export const strategyRegistry: StrategyDefinition[] = [
  { id: BREAKOUT_H4_STRATEGY_ID, name: BREAKOUT_METHOD_NAME, description: "H4 XAUUSD breakout strategy.", status: "READY", signalTimeframe: "H4", executionTimeframe: "M1", validateConfig: () => ({ valid: true, errors: [] }) },
  xauTrendPullbackH1Strategy,
];
export function getStrategy(id: string): StrategyDefinition | undefined { return strategyRegistry.find((s) => s.id === id); }

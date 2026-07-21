import type { StrategyDefinition } from "@/strategies/types";
import { BREAKOUT_H4_EMA_TREND_ID, BREAKOUT_H4_EMA_TREND_NAME } from "./config";

export const breakoutH4EmaTrendStrategy: StrategyDefinition = { id: BREAKOUT_H4_EMA_TREND_ID, name: BREAKOUT_H4_EMA_TREND_NAME, description: "Breakout H4 existing dengan filter arah EMA50/EMA200 H4 closed.", status: "READY", signalTimeframe: "H4", executionTimeframe: "M1", validateConfig: () => ({ valid: true, errors: [] }) };

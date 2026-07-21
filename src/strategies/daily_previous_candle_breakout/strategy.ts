import type { StrategyDefinition } from "@/strategies/types";
import { DAILY_PREVIOUS_CANDLE_BREAKOUT_ID, DAILY_PREVIOUS_CANDLE_BREAKOUT_NAME } from "./config";

export const dailyPreviousCandleBreakoutStrategy: StrategyDefinition = {
  id: DAILY_PREVIOUS_CANDLE_BREAKOUT_ID,
  name: DAILY_PREVIOUS_CANDLE_BREAKOUT_NAME,
  description: "Breakout Buy Stop/Sell Stop dari high/low Daily closed sebelumnya.",
  status: "READY",
  signalTimeframe: "D1",
  executionTimeframe: "M1",
  validateConfig: () => ({ valid: true, errors: [] }),
};

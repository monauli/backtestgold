import type { StrategyDefinition } from "@/strategies/types";
import { BREAKOUT_H4_STOP_AFTER_1_LOSS_ID, BREAKOUT_H4_STOP_AFTER_1_LOSS_NAME } from "./config";

export const breakoutH4StopAfter1LossStrategy: StrategyDefinition = {
  id: BREAKOUT_H4_STOP_AFTER_1_LOSS_ID,
  name: BREAKOUT_H4_STOP_AFTER_1_LOSS_NAME,
  description: "Breakout H4 existing dengan stop entry setelah satu realized loss per UTC day.",
  status: "READY",
  signalTimeframe: "H4",
  executionTimeframe: "M1",
  validateConfig: () => ({ valid: true, errors: [] }),
};

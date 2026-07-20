import type { ValidationResult } from "@/strategies/types";
import type { XauTrendPullbackH1Config } from "./types";

export function validateXauTrendPullbackH1Config(config: unknown): ValidationResult {
  const c = (config ?? {}) as Partial<XauTrendPullbackH1Config>;
  const errors: string[] = [];
  if (c.strategyId !== "xau_trend_pullback_h1") errors.push("Invalid strategyId");
  if (!(c.lot && c.lot > 0)) errors.push("Lot must be positive");
  if (!(c.initialBalance && c.initialBalance > 0)) errors.push("Initial balance must be positive");
  errors.push("Trend definition is not specified");
  errors.push("Pullback definition is not specified");
  errors.push("Buy/Sell entry rules are not specified");
  errors.push("Stop Loss and Take Profit rules are not specified");
  return { valid: false, errors };
}

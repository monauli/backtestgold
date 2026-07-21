import type { ValidationResult } from "@/strategies/types";
import type { XauTrendPullbackH1Config } from "./types";

export function validateXauTrendPullbackH1Config(config: unknown): ValidationResult {
  const c = (config ?? {}) as Partial<XauTrendPullbackH1Config>;
  const errors: string[] = [];
  if (c.strategyId !== "xau_trend_pullback_h1") errors.push("Invalid strategyId");
  if (!(c.lot && c.lot > 0)) errors.push("Lot must be positive");
  if (!(c.initialBalance && c.initialBalance > 0)) errors.push("Initial balance must be positive");
  if (c.strategyName !== "XAU Trend Pullback H1") errors.push("Invalid strategyName");
  if (c.riskReward !== 2) errors.push("Risk reward must be 1:2");
  return { valid: errors.length === 0, errors };
}

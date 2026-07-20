export type ValidationResult = { valid: boolean; errors: string[] };
export type StrategyContext = { config: unknown; candles: unknown[] };
export type StrategyResult = { trades: unknown[]; equity: unknown[] };
export type StrategyDefinition = {
  id: string;
  name: string;
  description: string;
  status: "READY" | "DRAFT";
  signalTimeframe: string;
  executionTimeframe?: string | null;
  validateConfig: (config: unknown) => ValidationResult;
  run?: (context: StrategyContext) => Promise<StrategyResult>;
};

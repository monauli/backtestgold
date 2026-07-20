export type BacktestProcessMode = "INLINE" | "CRON";

export function getBacktestProcessMode(): BacktestProcessMode {
  const configured = process.env.BACKTEST_PROCESS_MODE?.toUpperCase();
  if (configured === "INLINE" || configured === "CRON") return configured;
  return process.env.NODE_ENV === "production" ? "CRON" : "INLINE";
}

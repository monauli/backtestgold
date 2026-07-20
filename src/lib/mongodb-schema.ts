import type { Db } from "mongodb";

export const CLOUD_COLLECTIONS = [
  "candles", "data_sync_state", "data_sync_locks", "backtest_jobs", "backtest_runs",
  "backtest_trades", "backtest_equity", "backtest_templates", "backtest_counters", "strategy_registry", "batch_backtest_jobs", "batch_backtest_results",
] as const;

const strategies = [
  { strategyId: "xau_h4_breakout", name: "Breakout H4", status: "READY", signalTimeframe: "H4", executionTimeframe: "M1" },
  { strategyId: "xau_trend_pullback_h1", name: "XAU Trend Pullback H1", status: "DRAFT", signalTimeframe: "H1", executionTimeframe: null },
];

export async function initializeMongoSchema(db: Db) {
  const existing = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map((x) => x.name));
  for (const name of CLOUD_COLLECTIONS) if (!existing.has(name)) await db.createCollection(name);

  await db.collection("candles").createIndex({ symbol: 1, timeframe: 1, timestamp: 1 }, { unique: true, name: "candle_unique_key" });
  await db.collection("data_sync_state").createIndex({ symbol: 1, timeframe: 1 }, { unique: true, name: "sync_symbol_timeframe" });
  await db.collection("data_sync_locks").createIndex({ symbol: 1, timeframe: 1 }, { unique: true, name: "lock_symbol_timeframe" });
  await db.collection("backtest_jobs").createIndex({ runId: 1 }, { unique: true, name: "job_run_id" });
  await db.collection("backtest_jobs").createIndex({ status: 1, createdAt: 1 }, { name: "job_status_created" });
  await db.collection("backtest_runs").createIndex({ runId: 1 }, { unique: true, name: "run_id" });
  await db.collection("backtest_trades").createIndex({ runId: 1, tradeSequence: 1 }, { unique: true, name: "trade_run_sequence" });
  await db.collection("backtest_equity").createIndex({ runId: 1, sequence: 1 }, { unique: true, name: "equity_run_sequence" });
  await db.collection("backtest_templates").createIndex({ strategyId: 1, templateName: 1 }, { unique: true, name: "template_strategy_name" });
  await db.collection("backtest_counters").createIndex({ key: 1 }, { unique: true, name: "counter_key" });
  await db.collection("strategy_registry").createIndex({ strategyId: 1 }, { unique: true, name: "strategy_id" });
  await db.collection("batch_backtest_jobs").createIndex({ batchId: 1 }, { unique: true, name: "batch_job_id" });
  await db.collection("batch_backtest_results").createIndex({ batchId: 1, combinationId: 1 }, { unique: true, name: "batch_result_combination" });
  await db.collection("batch_backtest_results").createIndex({ batchId: 1, profitFactor: -1 }, { name: "batch_result_profit_factor" });
  await db.collection("batch_backtest_results").createIndex({ batchId: 1, winRate: -1 }, { name: "batch_result_win_rate" });
  await db.collection("batch_backtest_results").createIndex({ batchId: 1, netProfit: -1 }, { name: "batch_result_net_profit" });

  const now = new Date();
  await db.collection("backtest_counters").updateOne(
    { key: "xau_backtest" },
    { $setOnInsert: { key: "xau_backtest", lastNumber: 0, createdAt: now }, $set: { updatedAt: now } },
    { upsert: true },
  );
  for (const strategy of strategies) {
    await db.collection("strategy_registry").updateOne(
      { strategyId: strategy.strategyId },
      { $set: { ...strategy, updatedAt: now }, $setOnInsert: { createdAt: now } },
      { upsert: true },
    );
  }
}

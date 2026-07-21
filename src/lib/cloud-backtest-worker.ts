import { getMongoDb } from "./mongodb";
import { MongoCandleRepository } from "@/data/mongo-candle-repository";
import { BreakoutEngine } from "@/backtest/engine";
import { computeMetrics } from "@/backtest/metrics";
import { pipsToPrice, CALCULATION_VERSION, BREAKOUT_METHOD_NAME, PIP_SIZE, PIP_VALUE_PER_LOT_USD } from "@/backtest/methods";
import type { BacktestRequest, BacktestTrade, EngineParams, EquityPoint } from "@/backtest/types";
import { runTrendPullbackH1Request } from "@/strategies/xau_trend_pullback_h1/runner";
import { XAU_TREND_PULLBACK_H1_ID, XAU_TREND_PULLBACK_H1_NAME } from "@/strategies/xau_trend_pullback_h1/config";
import { BREAKOUT_H4_EMA_TREND_ID, BREAKOUT_H4_EMA_TREND_NAME, BREAKOUT_H4_EMA_TREND_WARMUP, buildH4EmaTrendFilter } from "@/strategies/breakout_h4_ema_trend";
import { BREAKOUT_H4_STOP_AFTER_1_LOSS_ID, BREAKOUT_H4_STOP_AFTER_1_LOSS_NAME, BREAKOUT_H4_STOP_AFTER_1_LOSS_RULE, createStopAfterOneDailyLoss, existingCandleTimezone, summarizeDailyLosses } from "@/strategies/breakout_h4_stop_after_1_loss";
import { DAILY_PREVIOUS_CANDLE_BREAKOUT_ID, DAILY_PREVIOUS_CANDLE_BREAKOUT_NAME, DAILY_PREVIOUS_CANDLE_BREAKOUT_ENTRY_OFFSET, DailyPreviousCandleBreakoutEngine } from "@/strategies/daily_previous_candle_breakout";
import { ORDERFLOW_CONFLUENCE_V1_ID, ORDERFLOW_CONFLUENCE_V1_NAME } from "@/strategies/orderflow_confluence_v1/config";
import { runOrderflowConfluenceV1, type OfcConfig } from "@/strategies/orderflow_confluence_v1/engine";

type CloudJob = {
  runId: string; config: BacktestRequest; createdAt: Date; status: "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED";
  retryCount?: number;
};

function safeError(error: unknown) {
  return error instanceof Error ? error.message.split("\n")[0].slice(0, 500) : "BACKTEST_WORKER_FAILED";
}
class WorkerValidationError extends Error {
  constructor(public code: string, public details: Record<string, unknown>) { super(code); }
}

function validateTrades(runId: string, trades: BacktestTrade[]) {
  const allowedResults = new Set(["WIN", "LOSS", "BREAKEVEN", "AMBIGUOUS", "SKIPPED", "OPEN_AT_END"]);
  const ordered = [...trades].sort((a, b) => (a.entryTime || "").localeCompare(b.entryTime || "") || (a.exitTime || "").localeCompare(b.exitTime || "") || a.id.localeCompare(b.id));
  const seen = new Set<number>();
  const documents = ordered.map((trade, index) => {
    const tradeSequence = index + 1;
    if (!runId) throw new Error("INVALID_RUN_ID");
    if (!Number.isInteger(tradeSequence) || tradeSequence < 1) throw new Error("INVALID_TRADE_SEQUENCE");
    if (seen.has(tradeSequence)) throw new Error("TRADE_SEQUENCE_DUPLICATE_IN_MEMORY");
    seen.add(tradeSequence);
    if (!trade.entryTime) throw new Error("TRADE_ENTRY_TIME_MISSING");
    if (trade.direction !== "BUY" && trade.direction !== "SELL") throw new Error("INVALID_TRADE_DIRECTION");
    if (!Number.isFinite(trade.entryPrice)) throw new Error("INVALID_TRADE_ENTRY_PRICE");
    if (!allowedResults.has(trade.result)) throw new Error("INVALID_TRADE_RESULT");
    if (!Number.isFinite(trade.netProfit) || !Number.isFinite(trade.balanceAfter)) throw new Error("INVALID_TRADE_FINANCIAL_VALUE");
    return { ...trade, runId, tradeSequence };
  });
  return { ordered, documents };
}

function validateEquity(runId: string, equity: EquityPoint[]) {
  const documents = equity.map((point, sequence) => {
    if (!runId || !Number.isInteger(sequence) || sequence < 0) throw new Error("INVALID_EQUITY_SEQUENCE");
    if (!point.time || !Number.isFinite(point.balance)) throw new Error("INVALID_EQUITY_POINT");
    return { runId, sequence, time: point.time, balance: point.balance };
  });
  return documents;
}

export function tradeUpsertOperations(documents: Array<BacktestTrade & { runId: string; tradeSequence: number }>) {
  return documents.map((trade) => ({ updateOne: { filter: { runId: trade.runId, tradeSequence: trade.tradeSequence }, update: { $set: trade }, upsert: true } }));
}

export function equityUpsertOperations(documents: Array<EquityPoint & { runId: string; sequence: number }>) {
  return documents.map((point) => ({ updateOne: { filter: { runId: point.runId, sequence: point.sequence }, update: { $set: point }, upsert: true } }));
}

async function processTrendPullbackH1Job(db: Awaited<ReturnType<typeof getMongoDb>>, job: CloudJob, req: BacktestRequest, from: Date, to: Date) {
  const repo = new MongoCandleRepository();
  const h1 = await repo.getCandles("XAUUSD", "H1", from, to);
  await db.collection("backtest_jobs").updateOne({ runId: job.runId }, { $set: { progress: 25, currentStep: `Loaded ${h1.length} H1 candles` } });
  if (h1.length < 205) throw new Error("INSUFFICIENT_H1_WARMUP");
  const result = runTrendPullbackH1Request(req, h1); const executedTrades = result.engine.trades;
  const { documents: tradeDocuments } = validateTrades(job.runId, executedTrades); const equityDocuments = validateEquity(job.runId, result.engine.equity); const metrics = computeMetrics(result.engine.trades, result.engine.equity, req.initialBalance);
  const config = { runId: job.runId, strategyId: XAU_TREND_PULLBACK_H1_ID, strategyName: XAU_TREND_PULLBACK_H1_NAME, method: XAU_TREND_PULLBACK_H1_NAME, ...req, requestedStartDate: req.startDate, effectiveTradingStart: result.engine.effectiveTradingStart, warmupCandlesUsed: result.engine.warmupCandlesUsed, executionTimeframe: "H1", riskReward: 2, emaFastPeriod: 50, emaSlowPeriod: 200, atrPeriod: 14, warmupCandles: 204, pullbackAtrTolerance: 0.25, trendAtrSeparation: 0.5, swingLookback: 10, swingFractalRadius: 2, swingBufferAtr: 0.1, stopAtrMultiple: 1.5, confirmationBodyMin: 0.5, confirmationCloseTopFraction: 0.75, maxTradesPerDay: 2, maxLossesPerDay: 2, calculationVersion: CALCULATION_VERSION, pipSize: PIP_SIZE, pipValuePerLotUSD: PIP_VALUE_PER_LOT_USD };
  const trades = db.collection("backtest_trades"); const equity = db.collection("backtest_equity");
  await trades.deleteMany({ runId: job.runId, $or: [{ tradeSequence: null }, { tradeSequence: { $exists: false } }] }); await equity.deleteMany({ runId: job.runId, $or: [{ sequence: null }, { sequence: { $exists: false } }] });
  if (tradeDocuments.length) await trades.bulkWrite(tradeUpsertOperations(tradeDocuments), { ordered: false }); if (equityDocuments.length) await equity.bulkWrite(equityUpsertOperations(equityDocuments), { ordered: false });
  const now = new Date(); await db.collection("backtest_runs").replaceOne({ runId: job.runId }, { runId: job.runId, strategyId: XAU_TREND_PULLBACK_H1_ID, strategyName: XAU_TREND_PULLBACK_H1_NAME, config, summary: metrics, calculationVersion: CALCULATION_VERSION, createdAt: job.createdAt, completedAt: now }, { upsert: true });
  await db.collection("backtest_jobs").updateOne({ runId: job.runId }, { $set: { status: "COMPLETED", progress: 100, currentStep: "COMPLETED", completedAt: now, error: null, errorCode: null, checkpoint: { lastProcessedH1Timestamp: to, balance: result.engine.balance, tradeSequence: tradeDocuments.length, equitySequence: equityDocuments.length } } });
  return { status: "COMPLETED" as const, runId: job.runId, tradeCount: tradeDocuments.length, equityCount: equityDocuments.length, progress: 100 };
}

async function processBreakoutH4EmaTrendJob(db: Awaited<ReturnType<typeof getMongoDb>>, job: CloudJob, req: BacktestRequest, from: Date, to: Date) {
  const repo = new MongoCandleRepository(); const h4 = await repo.getCandles("XAUUSD", "H4", new Date(from.getTime() - 2400 * 3600_000), to); const m1 = await repo.getCandles("XAUUSD", "M1", from, to);
  await db.collection("backtest_jobs").updateOne({ runId: job.runId }, { $set: { progress: 25, currentStep: `Loaded ${h4.length + m1.length} candles` } });
  if (h4.length < BREAKOUT_H4_EMA_TREND_WARMUP + 2 || !m1.length) throw new Error("INSUFFICIENT_H4_EMA_WARMUP");
  const trend = buildH4EmaTrendFilter(h4, from.getTime()); const params: EngineParams = { breakoutDistance: pipsToPrice(req.breakoutPips), stopLossDistance: pipsToPrice(req.stopLossPips), takeProfitDistance: pipsToPrice(req.takeProfitPips), lot: req.lot, initialBalance: req.initialBalance, spread: 0, slippage: 0, commission: 0, session: "ALL", ambiguousHandling: "SKIP", entryFilter: trend.filter };
  const engine = new BreakoutEngine(h4, params); for (const candle of m1) engine.onM1(candle); engine.finish(); engine.equity[0].time = from.toISOString();
  const executedTrades = engine.trades.filter(trade => trade.result !== "SKIPPED" && trade.result !== "AMBIGUOUS"); const { documents: tradeDocuments } = validateTrades(job.runId, executedTrades); const equityDocuments = validateEquity(job.runId, engine.equity); const metrics = computeMetrics(engine.trades, engine.equity, req.initialBalance); const config = { runId: job.runId, strategyId: BREAKOUT_H4_EMA_TREND_ID, strategyName: BREAKOUT_H4_EMA_TREND_NAME, method: BREAKOUT_H4_EMA_TREND_NAME, ...req, breakoutPriceDistance: pipsToPrice(req.breakoutPips), stopLossPriceDistance: pipsToPrice(req.stopLossPips), takeProfitPriceDistance: pipsToPrice(req.takeProfitPips), riskReward: req.takeProfitPips / req.stopLossPips, emaFastPeriod: 50, emaSlowPeriod: 200, warmupCandles: trend.warmupCandlesUsed, pipSize: PIP_SIZE, pipValuePerLotUSD: PIP_VALUE_PER_LOT_USD, calculationVersion: CALCULATION_VERSION };
  const trades = db.collection("backtest_trades"); const equity = db.collection("backtest_equity"); await trades.deleteMany({ runId: job.runId, $or: [{ tradeSequence: null }, { tradeSequence: { $exists: false } }] }); await equity.deleteMany({ runId: job.runId, $or: [{ sequence: null }, { sequence: { $exists: false } }] }); if (tradeDocuments.length) await trades.bulkWrite(tradeUpsertOperations(tradeDocuments), { ordered: false }); if (equityDocuments.length) await equity.bulkWrite(equityUpsertOperations(equityDocuments), { ordered: false });
  const now = new Date(); await db.collection("backtest_runs").replaceOne({ runId: job.runId }, { runId: job.runId, strategyId: BREAKOUT_H4_EMA_TREND_ID, strategyName: BREAKOUT_H4_EMA_TREND_NAME, config, summary: metrics, calculationVersion: CALCULATION_VERSION, createdAt: job.createdAt, completedAt: now }, { upsert: true }); await db.collection("backtest_jobs").updateOne({ runId: job.runId }, { $set: { status: "COMPLETED", progress: 100, currentStep: "COMPLETED", completedAt: now, error: null, errorCode: null, checkpoint: { lastProcessedH4Timestamp: to, balance: engine.balance, tradeSequence: tradeDocuments.length, equitySequence: equityDocuments.length } } }); return { status: "COMPLETED" as const, runId: job.runId, tradeCount: tradeDocuments.length, equityCount: equityDocuments.length, progress: 100 };
}

async function processBreakoutH4StopAfter1LossJob(db: Awaited<ReturnType<typeof getMongoDb>>, job: CloudJob, req: BacktestRequest, from: Date, to: Date) {
  const repo = new MongoCandleRepository(); const h4 = await repo.getCandles("XAUUSD", "H4", new Date(from.getTime() - 8 * 3600_000), to); const m1 = await repo.getCandles("XAUUSD", "M1", from, to);
  await db.collection("backtest_jobs").updateOne({ runId: job.runId }, { $set: { progress: 25, currentStep: `Loaded ${h4.length + m1.length} candles` } });
  if (h4.length < 2 || !m1.length) throw new Error("INSUFFICIENT_CLOUD_CANDLES");
  const stop = createStopAfterOneDailyLoss(); const params: EngineParams = { breakoutDistance: pipsToPrice(req.breakoutPips), stopLossDistance: pipsToPrice(req.stopLossPips), takeProfitDistance: pipsToPrice(req.takeProfitPips), lot: req.lot, initialBalance: req.initialBalance, spread: 0, slippage: 0, commission: 0, session: "ALL", ambiguousHandling: "SKIP", entryGuard: stop.canEnter, onTradeClosed: stop.onTradeClosed };
  const engine = new BreakoutEngine(h4, params); for (const candle of m1) engine.onM1(candle); engine.finish(); engine.equity[0].time = from.toISOString();
  const executedTrades = engine.trades.filter(trade => trade.result !== "SKIPPED" && trade.result !== "AMBIGUOUS"); const { documents: tradeDocuments } = validateTrades(job.runId, executedTrades); const equityDocuments = validateEquity(job.runId, engine.equity); const metrics = computeMetrics(engine.trades, engine.equity, req.initialBalance); const daily = summarizeDailyLosses(engine.trades);
  const config = { runId: job.runId, strategyId: BREAKOUT_H4_STOP_AFTER_1_LOSS_ID, strategyName: BREAKOUT_H4_STOP_AFTER_1_LOSS_NAME, method: BREAKOUT_H4_STOP_AFTER_1_LOSS_NAME, ...req, breakoutPriceDistance: pipsToPrice(req.breakoutPips), stopLossPriceDistance: pipsToPrice(req.stopLossPips), takeProfitPriceDistance: pipsToPrice(req.takeProfitPips), riskReward: req.takeProfitPips / req.stopLossPips, dailyStopRule: BREAKOUT_H4_STOP_AFTER_1_LOSS_RULE, dailyStopTimezone: existingCandleTimezone, dailyBlockedDays: stop.stats.blockedDays.size, dailySkippedSignals: stop.stats.skippedSignals, worstDailyLoss: daily.worstDailyLoss, consecutiveLosingDays: daily.consecutiveLosingDays, pipSize: PIP_SIZE, pipValuePerLotUSD: PIP_VALUE_PER_LOT_USD, calculationVersion: CALCULATION_VERSION };
  const trades = db.collection("backtest_trades"); const equity = db.collection("backtest_equity"); await trades.deleteMany({ runId: job.runId, $or: [{ tradeSequence: null }, { tradeSequence: { $exists: false } }] }); await equity.deleteMany({ runId: job.runId, $or: [{ sequence: null }, { sequence: { $exists: false } }] }); if (tradeDocuments.length) await trades.bulkWrite(tradeUpsertOperations(tradeDocuments), { ordered: false }); if (equityDocuments.length) await equity.bulkWrite(equityUpsertOperations(equityDocuments), { ordered: false });
  const now = new Date(); await db.collection("backtest_runs").replaceOne({ runId: job.runId }, { runId: job.runId, strategyId: BREAKOUT_H4_STOP_AFTER_1_LOSS_ID, strategyName: BREAKOUT_H4_STOP_AFTER_1_LOSS_NAME, config, summary: metrics, calculationVersion: CALCULATION_VERSION, createdAt: job.createdAt, completedAt: now }, { upsert: true }); await db.collection("backtest_jobs").updateOne({ runId: job.runId }, { $set: { status: "COMPLETED", progress: 100, currentStep: "COMPLETED", completedAt: now, error: null, errorCode: null, checkpoint: { lastProcessedH4Timestamp: to, balance: engine.balance, tradeSequence: tradeDocuments.length, equitySequence: equityDocuments.length } } }); return { status: "COMPLETED" as const, runId: job.runId, tradeCount: tradeDocuments.length, equityCount: equityDocuments.length, progress: 100 };
}

async function processDailyPreviousCandleBreakoutJob(db: Awaited<ReturnType<typeof getMongoDb>>, job: CloudJob, req: BacktestRequest, from: Date, to: Date) {
  const repo = new MongoCandleRepository(); const daily = await repo.getCandles("XAUUSD", "D1", new Date(0), to); const m1 = await repo.getCandles("XAUUSD", "M1", from, to);
  await db.collection("backtest_jobs").updateOne({ runId: job.runId }, { $set: { progress: 25, currentStep: `Loaded ${daily.length} original D1 and ${m1.length} M1 candles` } });
  if (daily.length < 2 || !m1.length) throw new Error("INSUFFICIENT_D1_M1_CANDLES");
  const engine = new DailyPreviousCandleBreakoutEngine(daily, { breakoutDistance: 0, stopLossDistance: pipsToPrice(req.stopLossPips), takeProfitDistance: pipsToPrice(req.takeProfitPips), lot: req.lot, initialBalance: req.initialBalance, spread: 0, slippage: 0, commission: 0, session: "ALL", ambiguousHandling: "SKIP", entryOffset: Number(req.entryOffset ?? DAILY_PREVIOUS_CANDLE_BREAKOUT_ENTRY_OFFSET) }); for (const candle of m1) engine.onM1(candle); engine.finish(); engine.equity[0].time = from.toISOString();
  const executedTrades = engine.trades.filter((trade) => trade.result !== "SKIPPED" && trade.result !== "AMBIGUOUS"); const { documents: tradeDocuments } = validateTrades(job.runId, executedTrades); const equityDocuments = validateEquity(job.runId, engine.equity); const metrics = computeMetrics(engine.trades, engine.equity, req.initialBalance); metrics.ambiguousTrades = engine.ambiguousSignals; metrics.skippedTrades = engine.skippedSignals;
  const config = { runId: job.runId, strategyId: DAILY_PREVIOUS_CANDLE_BREAKOUT_ID, strategyName: DAILY_PREVIOUS_CANDLE_BREAKOUT_NAME, method: DAILY_PREVIOUS_CANDLE_BREAKOUT_NAME, ...req, entryOffset: Number(req.entryOffset ?? DAILY_PREVIOUS_CANDLE_BREAKOUT_ENTRY_OFFSET), previousDailyHigh: engine.previousDailyHigh ?? undefined, previousDailyLow: engine.previousDailyLow ?? undefined, buyStop: engine.buyStop ?? undefined, sellStop: engine.sellStop ?? undefined, noTriggerDays: engine.noTriggerDays, pendingExpiredDays: engine.pendingExpiredDays, dailyAmbiguousCandles: engine.ambiguousSignals, dailyStopTimezone: "UTC", calculationVersion: CALCULATION_VERSION, pipSize: PIP_SIZE, pipValuePerLotUSD: PIP_VALUE_PER_LOT_USD };
  const trades = db.collection("backtest_trades"); const equity = db.collection("backtest_equity"); await trades.deleteMany({ runId: job.runId, $or: [{ tradeSequence: null }, { tradeSequence: { $exists: false } }] }); await equity.deleteMany({ runId: job.runId, $or: [{ sequence: null }, { sequence: { $exists: false } }] }); if (tradeDocuments.length) await trades.bulkWrite(tradeUpsertOperations(tradeDocuments), { ordered: false }); if (equityDocuments.length) await equity.bulkWrite(equityUpsertOperations(equityDocuments), { ordered: false });
  const now = new Date(); await db.collection("backtest_runs").replaceOne({ runId: job.runId }, { runId: job.runId, strategyId: DAILY_PREVIOUS_CANDLE_BREAKOUT_ID, strategyName: DAILY_PREVIOUS_CANDLE_BREAKOUT_NAME, config, summary: metrics, calculationVersion: CALCULATION_VERSION, createdAt: job.createdAt, completedAt: now }, { upsert: true }); await db.collection("backtest_jobs").updateOne({ runId: job.runId }, { $set: { status: "COMPLETED", progress: 100, currentStep: "COMPLETED", completedAt: now, error: null, errorCode: null, checkpoint: { lastProcessedD1Timestamp: to, balance: engine.balance, tradeSequence: tradeDocuments.length, equitySequence: equityDocuments.length } } }); return { status: "COMPLETED" as const, runId: job.runId, tradeCount: tradeDocuments.length, equityCount: equityDocuments.length, progress: 100 };
}

function orderflowConfig(req: BacktestRequest): OfcConfig {
  return {
    lot: req.lot, initialBalance: req.initialBalance, riskReward: req.riskReward ?? 2,
    stopBufferPips: req.stopBufferPips ?? 20, minimumStopDistancePips: req.minimumStopDistancePips ?? 20,
    maximumStopDistancePips: req.maximumStopDistancePips ?? 500, maximumEntryDistanceFromLevelPips: req.maximumEntryDistanceFromLevelPips ?? 100,
    maximumTradesPerSession: req.maximumTradesPerSession ?? 1, maximumTradesPerDay: req.maxTradesPerDay ?? 2,
    cooldownBars: req.cooldownBars ?? 30, useProxyVwapBias: req.useProxyVwapBias ?? false,
    spreadPips: req.spreadPips ?? 0, slippagePips: req.slippagePips ?? 0, commissionPerLot: req.commissionPerLot ?? 0,
  };
}

async function processOrderflowConfluenceJob(db: Awaited<ReturnType<typeof getMongoDb>>, job: CloudJob, req: BacktestRequest, from: Date, to: Date) {
  const repo = new MongoCandleRepository();
  const [m1, d1] = await Promise.all([
    repo.getCandlesExclusive("XAUUSD", "M1", from, new Date(to.getTime() + 1)),
    repo.getCandlesExclusive("XAUUSD", "D1", new Date(from.getTime() - 22 * 86_400_000), new Date(to.getTime() + 1)),
  ]);
  await db.collection("backtest_jobs").updateOne({ runId: job.runId }, { $set: { progress: 25, currentStep: `Loaded ${m1.length} M1 and ${d1.length} D1 candles` } });
  if (!m1.length || d1.length < 2) throw new Error("INSUFFICIENT_ORDERFLOW_M1_D1_CANDLES");
  const cfg = orderflowConfig(req); const engine = runOrderflowConfluenceV1(m1, d1, cfg);
  const { documents: tradeDocuments } = validateTrades(job.runId, engine.trades); const equityDocuments = validateEquity(job.runId, engine.equity);
  const metrics = computeMetrics(engine.trades, engine.equity, req.initialBalance);
  const config = { runId: job.runId, strategyId: ORDERFLOW_CONFLUENCE_V1_ID, strategyName: ORDERFLOW_CONFLUENCE_V1_NAME, method: ORDERFLOW_CONFLUENCE_V1_NAME, ...req, ...cfg, rejectedSignals: engine.rejected, calculationVersion: CALCULATION_VERSION, pipSize: PIP_SIZE, pipValuePerLotUSD: PIP_VALUE_PER_LOT_USD };
  const trades = db.collection("backtest_trades"); const equity = db.collection("backtest_equity");
  if (tradeDocuments.length) await trades.bulkWrite(tradeUpsertOperations(tradeDocuments), { ordered: false });
  if (equityDocuments.length) await equity.bulkWrite(equityUpsertOperations(equityDocuments), { ordered: false });
  const now = new Date();
  await db.collection("backtest_runs").replaceOne({ runId: job.runId }, { runId: job.runId, strategyId: ORDERFLOW_CONFLUENCE_V1_ID, strategyName: ORDERFLOW_CONFLUENCE_V1_NAME, config, summary: metrics, calculationVersion: CALCULATION_VERSION, createdAt: job.createdAt, completedAt: now }, { upsert: true });
  await db.collection("backtest_jobs").updateOne({ runId: job.runId }, { $set: { status: "COMPLETED", progress: 100, currentStep: "COMPLETED", completedAt: now, error: null, errorCode: null, checkpoint: { lastProcessedM1Timestamp: to, balance: engine.balance, tradeSequence: tradeDocuments.length, equitySequence: equityDocuments.length } } });
  return { status: "COMPLETED" as const, runId: job.runId, tradeCount: tradeDocuments.length, equityCount: equityDocuments.length, progress: 100 };
}

export async function processOneCloudBacktest(targetRunId?: string) {
  const db = await getMongoDb();
  const jobs = db.collection<CloudJob>("backtest_jobs");
  const job = await jobs.findOneAndUpdate(
    { ...(targetRunId ? { runId: targetRunId } : {}), status: "QUEUED" },
    { $set: { status: "RUNNING", progress: 0, currentStep: "LOADING_DATA", startedAt: new Date(), completedAt: null, error: null, errorCode: null }, $inc: { retryCount: 1 } },
    { sort: { createdAt: 1 }, returnDocument: "after" },
  );
  if (!job) return { status: "IDLE" as const };
  try {
    const req = job.config; const from = new Date(`${req.startDate}T00:00:00.000Z`); const to = new Date(`${req.endDate}T23:59:59.999Z`);
    if (req.strategyId === BREAKOUT_H4_EMA_TREND_ID) return await processBreakoutH4EmaTrendJob(db, job, req, from, to);
    if (req.strategyId === BREAKOUT_H4_STOP_AFTER_1_LOSS_ID) return await processBreakoutH4StopAfter1LossJob(db, job, req, from, to);
    if (req.strategyId === DAILY_PREVIOUS_CANDLE_BREAKOUT_ID) return await processDailyPreviousCandleBreakoutJob(db, job, req, from, to);
    if (req.strategyId === XAU_TREND_PULLBACK_H1_ID) return await processTrendPullbackH1Job(db, job, req, from, to);
    if (req.strategyId === ORDERFLOW_CONFLUENCE_V1_ID) return await processOrderflowConfluenceJob(db, job, req, from, to);
    const repo = new MongoCandleRepository();
    const h4 = await repo.getCandles("XAUUSD", "H4", new Date(from.getTime() - 8 * 3600_000), to); const m1 = await repo.getCandles("XAUUSD", "M1", from, to);
    await jobs.updateOne({ runId: job.runId }, { $set: { progress: 25, currentStep: `Loaded ${h4.length + m1.length} candles` } });
    if (h4.length < 2 || !m1.length) throw new Error("INSUFFICIENT_CLOUD_CANDLES");
    const params: EngineParams = { breakoutDistance: pipsToPrice(req.breakoutPips), stopLossDistance: pipsToPrice(req.stopLossPips), takeProfitDistance: pipsToPrice(req.takeProfitPips), lot: req.lot, initialBalance: req.initialBalance, spread: 0, slippage: 0, commission: 0, session: "ALL", ambiguousHandling: "SKIP" };
    const engine = new BreakoutEngine(h4, params); for (const candle of m1) engine.onM1(candle); engine.finish(); engine.equity[0].time = from.toISOString();
    await jobs.updateOne({ runId: job.runId }, { $set: { progress: 60, currentStep: "Engine completed; validating output" } });
    const executedTrades = engine.trades.filter((trade) => trade.result !== "SKIPPED" && trade.result !== "AMBIGUOUS");
    const { documents: tradeDocuments } = validateTrades(job.runId, executedTrades); const equityDocuments = validateEquity(job.runId, engine.equity);
    const metrics = computeMetrics(engine.trades, engine.equity, req.initialBalance);
    const config = { runId: job.runId, strategyId: "xau_h4_breakout", strategyName: BREAKOUT_METHOD_NAME, method: BREAKOUT_METHOD_NAME, ...req, breakoutPriceDistance: pipsToPrice(req.breakoutPips), stopLossPriceDistance: pipsToPrice(req.stopLossPips), takeProfitPriceDistance: pipsToPrice(req.takeProfitPips), riskReward: req.takeProfitPips / req.stopLossPips, pipSize: PIP_SIZE, pipValuePerLotUSD: PIP_VALUE_PER_LOT_USD, calculationVersion: CALCULATION_VERSION };
    const trades = db.collection("backtest_trades"); const equity = db.collection("backtest_equity");
    await trades.deleteMany({ runId: job.runId, $or: [{ tradeSequence: null }, { tradeSequence: { $exists: false } }] });
    await equity.deleteMany({ runId: job.runId, $or: [{ sequence: null }, { sequence: { $exists: false } }] });
    if (tradeDocuments.length) await trades.bulkWrite(tradeUpsertOperations(tradeDocuments), { ordered: false });
    if (equityDocuments.length) await equity.bulkWrite(equityUpsertOperations(equityDocuments), { ordered: false });
    await jobs.updateOne({ runId: job.runId }, { $set: { progress: 85, currentStep: "Verifying stored result" } });
    const [tradeCount, winCount, lossCount, breakEvenCount, openAtEndCount, netProfitRows, equityCount] = await Promise.all([
      trades.countDocuments({ runId: job.runId }), trades.countDocuments({ runId: job.runId, netProfit: { $gt: 0 } }), trades.countDocuments({ runId: job.runId, netProfit: { $lt: 0 } }), trades.countDocuments({ runId: job.runId, netProfit: 0 }), trades.countDocuments({ runId: job.runId, result: "OPEN_AT_END" }),
      trades.aggregate([{ $match: { runId: job.runId } }, { $group: { _id: null, total: { $sum: "$netProfit" } } }]).toArray(), equity.countDocuments({ runId: job.runId }),
    ]);
    const netProfit = Number(netProfitRows[0]?.total ?? 0);
    const details = { expectedTotalTrades: metrics.totalTrades, storedTotalTrades: tradeCount, expectedWins: metrics.winningTrades, storedWins: winCount, expectedLosses: metrics.losingTrades, storedLosses: lossCount, expectedBreakEven: metrics.breakevenTrades, storedBreakEven: breakEvenCount, expectedOpenAtEnd: metrics.openAtEndTrades, storedOpenAtEnd: openAtEndCount, expectedNetProfit: metrics.netProfit, storedNetProfit: netProfit };
    if (tradeCount !== metrics.totalTrades || winCount !== metrics.winningTrades || lossCount !== metrics.losingTrades || breakEvenCount !== metrics.breakevenTrades || openAtEndCount !== metrics.openAtEndTrades || Math.abs(netProfit - metrics.netProfit) > 0.01 || equityCount !== equityDocuments.length) throw new WorkerValidationError("SUMMARY_TRADE_COUNT_MISMATCH", details);
    const now = new Date();
    await db.collection("backtest_runs").replaceOne({ runId: job.runId }, { runId: job.runId, strategyId: "xau_h4_breakout", strategyName: BREAKOUT_METHOD_NAME, config, summary: metrics, calculationVersion: CALCULATION_VERSION, createdAt: job.createdAt, completedAt: now }, { upsert: true });
    await jobs.updateOne({ runId: job.runId }, { $set: { status: "COMPLETED", progress: 100, currentStep: "COMPLETED", completedAt: now, error: null, errorCode: null, checkpoint: { lastProcessedH4Timestamp: to, balance: engine.balance, tradeSequence: tradeDocuments.length, equitySequence: equityDocuments.length } } });
    return { status: "COMPLETED" as const, runId: job.runId, tradeCount, equityCount, progress: 100 };
  } catch (error) {
    const code = error instanceof WorkerValidationError ? error.code : safeError(error); const message = error instanceof WorkerValidationError ? JSON.stringify(error.details) : safeError(error); await jobs.updateOne({ runId: job.runId }, { $set: { status: "FAILED", progress: 0, currentStep: "FAILED", errorCode: code, error: message, completedAt: new Date() } });
    return { status: "FAILED" as const, runId: job.runId, errorCode: code, error: message };
  }
}

export { validateTrades, validateEquity };

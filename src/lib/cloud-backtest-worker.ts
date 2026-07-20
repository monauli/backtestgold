import { getMongoDb } from "./mongodb";
import { MongoCandleRepository } from "@/data/mongo-candle-repository";
import { BreakoutEngine } from "@/backtest/engine";
import { computeMetrics } from "@/backtest/metrics";
import { pipsToPrice, CALCULATION_VERSION, BREAKOUT_METHOD_NAME, PIP_SIZE, PIP_VALUE_PER_LOT_USD } from "@/backtest/methods";
import type { BacktestRequest, BacktestTrade, EngineParams, EquityPoint } from "@/backtest/types";

type CloudJob = {
  runId: string; config: BacktestRequest; createdAt: Date; status: "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED";
  retryCount?: number;
};

function safeError(error: unknown) {
  return error instanceof Error ? error.message.split("\n")[0].slice(0, 500) : "BACKTEST_WORKER_FAILED";
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
    const req = job.config; const from = new Date(`${req.startDate}T00:00:00.000Z`); const to = new Date(`${req.endDate}T23:59:59.999Z`); const repo = new MongoCandleRepository();
    const h4 = await repo.getCandles("XAUUSD", "H4", new Date(from.getTime() - 8 * 3600_000), to); const m1 = await repo.getCandles("XAUUSD", "M1", from, to);
    await jobs.updateOne({ runId: job.runId }, { $set: { progress: 25, currentStep: `Loaded ${h4.length + m1.length} candles` } });
    if (h4.length < 2 || !m1.length) throw new Error("INSUFFICIENT_CLOUD_CANDLES");
    const params: EngineParams = { breakoutDistance: pipsToPrice(req.breakoutPips), stopLossDistance: pipsToPrice(req.stopLossPips), takeProfitDistance: pipsToPrice(req.takeProfitPips), lot: req.lot, initialBalance: req.initialBalance, spread: 0, slippage: 0, commission: 0, session: "ALL", ambiguousHandling: "SKIP" };
    const engine = new BreakoutEngine(h4, params); for (const candle of m1) engine.onM1(candle); engine.finish(); engine.equity[0].time = from.toISOString();
    await jobs.updateOne({ runId: job.runId }, { $set: { progress: 60, currentStep: "Engine completed; validating output" } });
    const { documents: tradeDocuments } = validateTrades(job.runId, engine.trades); const equityDocuments = validateEquity(job.runId, engine.equity);
    const metrics = computeMetrics(engine.trades, engine.equity, req.initialBalance);
    if (metrics.totalTrades !== tradeDocuments.length) throw new Error("SUMMARY_TRADE_COUNT_MISMATCH");
    const config = { runId: job.runId, strategyId: "xau_h4_breakout", strategyName: BREAKOUT_METHOD_NAME, method: BREAKOUT_METHOD_NAME, ...req, breakoutPriceDistance: pipsToPrice(req.breakoutPips), stopLossPriceDistance: pipsToPrice(req.stopLossPips), takeProfitPriceDistance: pipsToPrice(req.takeProfitPips), riskReward: req.takeProfitPips / req.stopLossPips, pipSize: PIP_SIZE, pipValuePerLotUSD: PIP_VALUE_PER_LOT_USD, calculationVersion: CALCULATION_VERSION };
    const trades = db.collection("backtest_trades"); const equity = db.collection("backtest_equity");
    await trades.deleteMany({ runId: job.runId, $or: [{ tradeSequence: null }, { tradeSequence: { $exists: false } }] });
    await equity.deleteMany({ runId: job.runId, $or: [{ sequence: null }, { sequence: { $exists: false } }] });
    if (tradeDocuments.length) await trades.bulkWrite(tradeUpsertOperations(tradeDocuments), { ordered: false });
    if (equityDocuments.length) await equity.bulkWrite(equityUpsertOperations(equityDocuments), { ordered: false });
    await jobs.updateOne({ runId: job.runId }, { $set: { progress: 85, currentStep: "Verifying stored result" } });
    const [tradeCount, winCount, lossCount, netProfitRows, equityCount] = await Promise.all([
      trades.countDocuments({ runId: job.runId }), trades.countDocuments({ runId: job.runId, netProfit: { $gt: 0 } }), trades.countDocuments({ runId: job.runId, netProfit: { $lt: 0 } }),
      trades.aggregate([{ $match: { runId: job.runId } }, { $group: { _id: null, total: { $sum: "$netProfit" } } }]).toArray(), equity.countDocuments({ runId: job.runId }),
    ]);
    const netProfit = Number(netProfitRows[0]?.total ?? 0); if (tradeCount !== metrics.totalTrades || winCount !== metrics.winningTrades || lossCount !== metrics.losingTrades || Math.abs(netProfit - metrics.netProfit) > 0.01 || equityCount !== equityDocuments.length) throw new Error("FINALIZATION_VERIFICATION_FAILED");
    const now = new Date();
    await db.collection("backtest_runs").replaceOne({ runId: job.runId }, { runId: job.runId, strategyId: "xau_h4_breakout", strategyName: BREAKOUT_METHOD_NAME, config, summary: metrics, calculationVersion: CALCULATION_VERSION, createdAt: job.createdAt, completedAt: now }, { upsert: true });
    await jobs.updateOne({ runId: job.runId }, { $set: { status: "COMPLETED", progress: 100, currentStep: "COMPLETED", completedAt: now, error: null, errorCode: null, checkpoint: { lastProcessedH4Timestamp: to, balance: engine.balance, tradeSequence: tradeDocuments.length, equitySequence: equityDocuments.length } } });
    return { status: "COMPLETED" as const, runId: job.runId, tradeCount, equityCount, progress: 100 };
  } catch (error) {
    const message = safeError(error); await jobs.updateOne({ runId: job.runId }, { $set: { status: "FAILED", progress: 0, currentStep: "FAILED", errorCode: message, error: message, completedAt: new Date() } });
    return { status: "FAILED" as const, runId: job.runId, errorCode: message, error: message };
  }
}

export { validateTrades, validateEquity };

import fs from "fs";
import path from "path";
import type {
  BacktestRequest, BacktestTrade, EngineParams, EquityPoint, RunSummary,
  StoredConfig,
} from "./types";
import { computeMetrics } from "./metrics";
import { BreakoutEngine } from "./engine";
import { pipsToPrice, PIP_SIZE, PIP_VALUE_PER_LOT_USD, CALCULATION_VERSION, BREAKOUT_METHOD_NAME } from "./methods";
import { ensureCache, loadCached, streamCached } from "@/data/cache";
import { BREAKOUT_H4_STRATEGY_ID } from "@/strategies/registry";
import { BREAKOUT_H4_EMA_TREND_ID, BREAKOUT_H4_EMA_TREND_NAME, BREAKOUT_H4_EMA_TREND_WARMUP, buildH4EmaTrendFilter } from "@/strategies/breakout_h4_ema_trend";
import { runTrendPullbackH1Request } from "@/strategies/xau_trend_pullback_h1/runner";
import { XAU_TREND_PULLBACK_H1_ID, XAU_TREND_PULLBACK_H1_NAME } from "@/strategies/xau_trend_pullback_h1/config";
import { BREAKOUT_H4_STOP_AFTER_1_LOSS_ID, BREAKOUT_H4_STOP_AFTER_1_LOSS_NAME, BREAKOUT_H4_STOP_AFTER_1_LOSS_RULE, createStopAfterOneDailyLoss, existingCandleTimezone, summarizeDailyLosses } from "@/strategies/breakout_h4_stop_after_1_loss";
import { DAILY_PREVIOUS_CANDLE_BREAKOUT_ID, DAILY_PREVIOUS_CANDLE_BREAKOUT_NAME, DAILY_PREVIOUS_CANDLE_BREAKOUT_ENTRY_OFFSET, DailyPreviousCandleBreakoutEngine } from "@/strategies/daily_previous_candle_breakout";

export const REPORTS_DIR = path.join(process.cwd(), "reports");
const INDEX_FILE = path.join(REPORTS_DIR, "index.json");
const COUNTER_FILE = path.join(REPORTS_DIR, "counter.json");
const RUN_ID_RE = /^(?:backtest\d{3}XAU|run-[\d-]+)$/;

function ensureDir(p: string) { fs.mkdirSync(p, { recursive: true }); }
function writeIndex(runs: RunSummary[]) { ensureDir(REPORTS_DIR); fs.writeFileSync(INDEX_FILE, JSON.stringify(runs, null, 2)); }
export function readIndex(): RunSummary[] { try { return JSON.parse(fs.readFileSync(INDEX_FILE, "utf8")); } catch { return []; } }
function upsertIndex(summary: RunSummary) {
  const runs = readIndex().filter((r) => r.runId !== summary.runId);
  runs.push(summary); runs.sort((a, b) => a.createdAt.localeCompare(b.createdAt)); writeIndex(runs);
}
function validRunId(runId: string) { return RUN_ID_RE.test(runId); }
export function readRun(runId: string): RunSummary | null {
  if (!validRunId(runId)) return null;
  try { return JSON.parse(fs.readFileSync(path.join(REPORTS_DIR, runId, "summary.json"), "utf8")); } catch { return null; }
}
export function readTrades(runId: string): BacktestTrade[] {
  if (!validRunId(runId)) return [];
  try { return JSON.parse(fs.readFileSync(path.join(REPORTS_DIR, runId, "trades.json"), "utf8")); } catch { return []; }
}
export function readEquity(runId: string): EquityPoint[] {
  if (!validRunId(runId)) return [];
  try {
    return fs.readFileSync(path.join(REPORTS_DIR, runId, "equity.csv"), "utf8").trim().split("\n").slice(1).map((l) => {
      const [time, balance] = l.split(","); return { time, balance: Number(balance) };
    });
  } catch { return []; }
}

export function nextRunId(): string {
  ensureDir(REPORTS_DIR);
  let last = 0;
  try { last = Number(JSON.parse(fs.readFileSync(COUNTER_FILE, "utf8")).lastNumber) || 0; } catch { /* first run */ }
  const used = readIndex().map((r) => r.runId.match(/^backtest(\d{3})XAU$/)?.[1]).filter(Boolean).map(Number);
  last = Math.max(last, ...used, 0) + 1;
  fs.writeFileSync(COUNTER_FILE, JSON.stringify({ lastNumber: last }, null, 2));
  return `backtest${String(last).padStart(3, "0")}XAU`;
}
export const newRunId = nextRunId;

function tradesToCsv(trades: BacktestTrade[]): string {
  const cols = ["id", "direction", "referenceH4Time", "referenceHigh", "referenceLow", "breakoutLevel", "entryTime", "entryPrice", "stopLoss", "takeProfit", "exitTime", "exitPrice", "result", "pips", "grossProfit", "commission", "netProfit", "balanceBefore", "balanceAfter"] as const;
  return [cols.join(","), ...trades.map((t) => cols.map((c) => t[c] ?? "").join(","))].join("\n") + "\n";
}
export function persistArtifacts(runId: string, trades: BacktestTrade[], equity: EquityPoint[]) {
  const dir = path.join(REPORTS_DIR, runId); ensureDir(dir);
  fs.writeFileSync(path.join(dir, "trades.csv"), tradesToCsv(trades));
  fs.writeFileSync(path.join(dir, "trades.json"), JSON.stringify(trades, null, 2));
  fs.writeFileSync(path.join(dir, "equity.csv"), ["time,balance", ...equity.map((p) => `${p.time},${p.balance}`)].join("\n") + "\n");
}

export function parseDate(name: string, value: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`${name} must use YYYY-MM-DD`);
  const ms = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(ms)) throw new Error(`${name} is invalid`);
  return ms;
}
export function calculateRiskReward(takeProfitPips: number, stopLossPips: number): number {
  if (!(takeProfitPips > 0) || !(stopLossPips > 0)) throw new Error("Pip distances must be positive");
  return takeProfitPips / stopLossPips;
}
export function validatePeriod(startDate: string, endDate: string, datasetStart: number, datasetEnd: number): { fromMs: number; toMs: number } {
  const fromMs = parseDate("startDate", startDate); const toMs = parseDate("endDate", endDate) + 24 * 3600_000 - 1;
  if (fromMs > toMs) throw new Error("startDate cannot be after endDate");
  if (dateOnly(fromMs) < dateOnly(datasetStart) || dateOnly(toMs) > dateOnly(datasetEnd)) throw new Error("Selected period is outside dataset");
  return { fromMs, toMs };
}
function dateOnly(ms: number) { return new Date(ms).toISOString().slice(0, 10); }

export async function runBacktest(req: BacktestRequest, runId = nextRunId()): Promise<RunSummary> {
  if (!validRunId(runId)) throw new Error("Invalid run ID");
  if (req.strategyId === BREAKOUT_H4_EMA_TREND_ID) return runBreakoutH4EmaTrendLocal(req, runId);
  if (req.strategyId === BREAKOUT_H4_STOP_AFTER_1_LOSS_ID) return runBreakoutH4StopAfter1LossLocal(req, runId);
  if (req.strategyId === DAILY_PREVIOUS_CANDLE_BREAKOUT_ID) return runDailyPreviousCandleBreakoutLocal(req, runId);
  if (req.strategyId === XAU_TREND_PULLBACK_H1_ID) return runTrendPullbackH1Local(req, runId);
  const dir = path.join(REPORTS_DIR, runId); ensureDir(dir);
  const summary: RunSummary = { runId, status: "RUNNING", createdAt: new Date().toISOString(), finishedAt: null, error: null, warnings: [], calculationVersion: CALCULATION_VERSION, config: {}, metrics: null };
  try {
    for (const [label, value] of [["Breakout", req.breakoutPips], ["Stop Loss", req.stopLossPips], ["Take Profit", req.takeProfitPips], ["Lot", req.lot], ["Initial balance", req.initialBalance]] as const) if (!(Number.isFinite(value) && value > 0)) throw new Error(`${label} must be positive`);
    const h4Meta = await ensureCache("H4"); const m1Meta = await ensureCache("M1");
    if (h4Meta.status !== "READY" || m1Meta.status !== "READY") throw new Error("H4 and M1 cache must be READY");
    const datasetStart = Math.max(Date.parse(h4Meta.firstDate!), Date.parse(m1Meta.firstDate!));
    const datasetEnd = Math.min(Date.parse(h4Meta.lastDate!), Date.parse(m1Meta.lastDate!));
    const startDate = req.startDate || (dateOnly(datasetStart) > "2020-01-01" ? dateOnly(datasetStart) : "2020-01-01");
    const endDate = req.endDate || dateOnly(datasetEnd);
    const { fromMs, toMs } = validatePeriod(startDate, endDate, datasetStart, datasetEnd);
    const config: StoredConfig = {
      runId, strategyId: req.strategyId ?? BREAKOUT_H4_STRATEGY_ID, strategyName: BREAKOUT_METHOD_NAME, method: BREAKOUT_METHOD_NAME, methodName: BREAKOUT_METHOD_NAME, lot: req.lot, initialBalance: req.initialBalance,
      pipSize: PIP_SIZE, pipValuePerLotUSD: PIP_VALUE_PER_LOT_USD, breakoutPips: req.breakoutPips,
      breakoutPriceDistance: pipsToPrice(req.breakoutPips), stopLossPips: req.stopLossPips,
      stopLossPriceDistance: pipsToPrice(req.stopLossPips), takeProfitPips: req.takeProfitPips,
      takeProfitPriceDistance: pipsToPrice(req.takeProfitPips), riskReward: calculateRiskReward(req.takeProfitPips, req.stopLossPips),
      startDate, endDate, calculationVersion: CALCULATION_VERSION,
    };
    summary.config = config; upsertIndex(summary); fs.writeFileSync(path.join(dir, "config.json"), JSON.stringify(config, null, 2));
    const params: EngineParams = { breakoutDistance: pipsToPrice(req.breakoutPips), stopLossDistance: pipsToPrice(req.stopLossPips), takeProfitDistance: pipsToPrice(req.takeProfitPips), lot: req.lot, initialBalance: req.initialBalance, spread: 0, slippage: 0, commission: 0, session: "ALL", ambiguousHandling: "SKIP" };
    const h4 = await loadCached("H4", fromMs - 8 * 3600_000, toMs); if (h4.length < 2) throw new Error("Not enough H4 candles");
    const engine = new BreakoutEngine(h4, params); let m1Count = 0;
    for await (const c of streamCached("M1", fromMs, toMs)) { m1Count++; engine.onM1(c); }
    if (!m1Count) throw new Error("No M1 candles in selected period");
    engine.finish(); engine.equity[0].time = new Date(fromMs).toISOString();
    if (m1Meta.gapCount > 0) summary.warnings.push(`M1 data has ${m1Meta.gapCount} time gaps; weekend gaps are normal.`);
    persistArtifacts(runId, engine.trades, engine.equity);
    const metrics = computeMetrics(engine.trades, engine.equity, req.initialBalance); metrics.skippedTrades = engine.skippedSignals; metrics.ambiguousTrades = engine.ambiguousSignals;
    summary.metrics = metrics; summary.status = "COMPLETED";
  } catch (e) { summary.status = "FAILED"; summary.error = e instanceof Error ? e.message : String(e); }
  summary.finishedAt = new Date().toISOString(); fs.writeFileSync(path.join(dir, "summary.json"), JSON.stringify(summary, null, 2)); upsertIndex(summary); return summary;
}

async function runBreakoutH4EmaTrendLocal(req: BacktestRequest, runId: string): Promise<RunSummary> {
  const dir = path.join(REPORTS_DIR, runId); ensureDir(dir);
  const summary: RunSummary = { runId, status: "RUNNING", createdAt: new Date().toISOString(), finishedAt: null, error: null, warnings: [], calculationVersion: CALCULATION_VERSION, config: {}, metrics: null };
  try {
    const h4Meta = await ensureCache("H4"); const m1Meta = await ensureCache("M1");
    if (h4Meta.status !== "READY" || m1Meta.status !== "READY") throw new Error("H4 and M1 cache must be READY");
    const fromMs = parseDate("startDate", req.startDate); const toMs = parseDate("endDate", req.endDate) + 24 * 3600_000 - 1;
    const h4 = await loadCached("H4", fromMs - 2400 * 3600_000, toMs); if (h4.length < BREAKOUT_H4_EMA_TREND_WARMUP + 2) throw new Error("INSUFFICIENT_H4_EMA_WARMUP");
    const trend = buildH4EmaTrendFilter(h4, fromMs);
    const config: StoredConfig = { runId, strategyId: BREAKOUT_H4_EMA_TREND_ID, strategyName: BREAKOUT_H4_EMA_TREND_NAME, method: BREAKOUT_H4_EMA_TREND_NAME, methodName: BREAKOUT_H4_EMA_TREND_NAME, lot: req.lot, initialBalance: req.initialBalance, pipSize: PIP_SIZE, pipValuePerLotUSD: PIP_VALUE_PER_LOT_USD, breakoutPips: req.breakoutPips, stopLossPips: req.stopLossPips, takeProfitPips: req.takeProfitPips, breakoutPriceDistance: pipsToPrice(req.breakoutPips), stopLossPriceDistance: pipsToPrice(req.stopLossPips), takeProfitPriceDistance: pipsToPrice(req.takeProfitPips), riskReward: calculateRiskReward(req.takeProfitPips, req.stopLossPips), startDate: req.startDate, endDate: req.endDate, calculationVersion: CALCULATION_VERSION, emaFastPeriod: 50, emaSlowPeriod: 200, warmupCandles: trend.warmupCandlesUsed };
    summary.config = config; upsertIndex(summary); fs.writeFileSync(path.join(dir, "config.json"), JSON.stringify(config, null, 2));
    const params: EngineParams = { breakoutDistance: pipsToPrice(req.breakoutPips), stopLossDistance: pipsToPrice(req.stopLossPips), takeProfitDistance: pipsToPrice(req.takeProfitPips), lot: req.lot, initialBalance: req.initialBalance, spread: 0, slippage: 0, commission: 0, session: "ALL", ambiguousHandling: "SKIP", entryFilter: trend.filter };
    const engine = new BreakoutEngine(h4, params); let m1Count = 0; for await (const c of streamCached("M1", fromMs, toMs)) { m1Count++; engine.onM1(c); }
    if (!m1Count) throw new Error("No M1 candles in selected period"); engine.finish(); engine.equity[0].time = new Date(fromMs).toISOString(); if (m1Meta.gapCount > 0) summary.warnings.push(`M1 data has ${m1Meta.gapCount} time gaps; weekend gaps are normal.`); persistArtifacts(runId, engine.trades, engine.equity);
    const metrics = computeMetrics(engine.trades, engine.equity, req.initialBalance); metrics.skippedTrades = engine.skippedSignals; metrics.ambiguousTrades = engine.ambiguousSignals; summary.metrics = metrics; summary.status = "COMPLETED";
  } catch (e) { summary.status = "FAILED"; summary.error = e instanceof Error ? e.message : String(e); }
  summary.finishedAt = new Date().toISOString(); fs.writeFileSync(path.join(dir, "summary.json"), JSON.stringify(summary, null, 2)); upsertIndex(summary); return summary;
}

async function runDailyPreviousCandleBreakoutLocal(req: BacktestRequest, runId: string): Promise<RunSummary> {
  const dir = path.join(REPORTS_DIR, runId); ensureDir(dir);
  const summary: RunSummary = { runId, status: "RUNNING", createdAt: new Date().toISOString(), finishedAt: null, error: null, warnings: [], calculationVersion: CALCULATION_VERSION, config: {}, metrics: null };
  try {
    const d1Meta = await ensureCache("D1"); const m1Meta = await ensureCache("M1"); if (d1Meta.status !== "READY" || m1Meta.status !== "READY") throw new Error("D1 and M1 cache must be READY");
    const fromMs = parseDate("startDate", req.startDate); const toMs = parseDate("endDate", req.endDate) + 24 * 3600_000 - 1; const daily = await loadCached("D1", 0, toMs); if (daily.length < 2) throw new Error("INSUFFICIENT_D1_M1_CANDLES");
    const engine = new DailyPreviousCandleBreakoutEngine(daily, { breakoutDistance: 0, stopLossDistance: pipsToPrice(req.stopLossPips), takeProfitDistance: pipsToPrice(req.takeProfitPips), lot: req.lot, initialBalance: req.initialBalance, spread: 0, slippage: 0, commission: 0, session: "ALL", ambiguousHandling: "SKIP", entryOffset: Number(req.entryOffset ?? DAILY_PREVIOUS_CANDLE_BREAKOUT_ENTRY_OFFSET) }); let m1Count = 0; for await (const c of streamCached("M1", fromMs, toMs)) { m1Count++; engine.onM1(c); } if (!m1Count) throw new Error("No M1 candles in selected period");
    engine.finish(); engine.equity[0].time = new Date(fromMs).toISOString(); const config: StoredConfig = { runId, strategyId: DAILY_PREVIOUS_CANDLE_BREAKOUT_ID, strategyName: DAILY_PREVIOUS_CANDLE_BREAKOUT_NAME, method: DAILY_PREVIOUS_CANDLE_BREAKOUT_NAME, methodName: DAILY_PREVIOUS_CANDLE_BREAKOUT_NAME, lot: req.lot, initialBalance: req.initialBalance, pipSize: PIP_SIZE, pipValuePerLotUSD: PIP_VALUE_PER_LOT_USD, stopLossPips: req.stopLossPips, takeProfitPips: req.takeProfitPips, stopLossPriceDistance: pipsToPrice(req.stopLossPips), takeProfitPriceDistance: pipsToPrice(req.takeProfitPips), riskReward: calculateRiskReward(req.takeProfitPips, req.stopLossPips), startDate: req.startDate, endDate: req.endDate, entryOffset: Number(req.entryOffset ?? DAILY_PREVIOUS_CANDLE_BREAKOUT_ENTRY_OFFSET), previousDailyHigh: engine.previousDailyHigh ?? undefined, previousDailyLow: engine.previousDailyLow ?? undefined, buyStop: engine.buyStop ?? undefined, sellStop: engine.sellStop ?? undefined, noTriggerDays: engine.noTriggerDays, pendingExpiredDays: engine.pendingExpiredDays, dailyAmbiguousCandles: engine.ambiguousSignals, dailyStopTimezone: "UTC", calculationVersion: CALCULATION_VERSION };
    summary.config = config; upsertIndex(summary); fs.writeFileSync(path.join(dir, "config.json"), JSON.stringify(config, null, 2)); persistArtifacts(runId, engine.trades, engine.equity); const metrics = computeMetrics(engine.trades, engine.equity, req.initialBalance); metrics.ambiguousTrades = engine.ambiguousSignals; metrics.skippedTrades = engine.skippedSignals; summary.metrics = metrics; summary.status = "COMPLETED";
  } catch (e) { summary.status = "FAILED"; summary.error = e instanceof Error ? e.message : String(e); }
  summary.finishedAt = new Date().toISOString(); fs.writeFileSync(path.join(dir, "summary.json"), JSON.stringify(summary, null, 2)); upsertIndex(summary); return summary;
}

async function runBreakoutH4StopAfter1LossLocal(req: BacktestRequest, runId: string): Promise<RunSummary> {
  const dir = path.join(REPORTS_DIR, runId); ensureDir(dir);
  const summary: RunSummary = { runId, status: "RUNNING", createdAt: new Date().toISOString(), finishedAt: null, error: null, warnings: [], calculationVersion: CALCULATION_VERSION, config: {}, metrics: null };
  try {
    const h4Meta = await ensureCache("H4"); const m1Meta = await ensureCache("M1");
    if (h4Meta.status !== "READY" || m1Meta.status !== "READY") throw new Error("H4 and M1 cache must be READY");
    const fromMs = parseDate("startDate", req.startDate); const toMs = parseDate("endDate", req.endDate) + 24 * 3600_000 - 1;
    const h4 = await loadCached("H4", fromMs - 8 * 3600_000, toMs); const stop = createStopAfterOneDailyLoss();
    const config: StoredConfig = { runId, strategyId: BREAKOUT_H4_STOP_AFTER_1_LOSS_ID, strategyName: BREAKOUT_H4_STOP_AFTER_1_LOSS_NAME, method: BREAKOUT_H4_STOP_AFTER_1_LOSS_NAME, methodName: BREAKOUT_H4_STOP_AFTER_1_LOSS_NAME, lot: req.lot, initialBalance: req.initialBalance, pipSize: PIP_SIZE, pipValuePerLotUSD: PIP_VALUE_PER_LOT_USD, breakoutPips: req.breakoutPips, stopLossPips: req.stopLossPips, takeProfitPips: req.takeProfitPips, breakoutPriceDistance: pipsToPrice(req.breakoutPips), stopLossPriceDistance: pipsToPrice(req.stopLossPips), takeProfitPriceDistance: pipsToPrice(req.takeProfitPips), riskReward: calculateRiskReward(req.takeProfitPips, req.stopLossPips), startDate: req.startDate, endDate: req.endDate, calculationVersion: CALCULATION_VERSION, dailyStopRule: BREAKOUT_H4_STOP_AFTER_1_LOSS_RULE, dailyStopTimezone: existingCandleTimezone };
    summary.config = config; upsertIndex(summary); fs.writeFileSync(path.join(dir, "config.json"), JSON.stringify(config, null, 2));
    const params: EngineParams = { breakoutDistance: pipsToPrice(req.breakoutPips), stopLossDistance: pipsToPrice(req.stopLossPips), takeProfitDistance: pipsToPrice(req.takeProfitPips), lot: req.lot, initialBalance: req.initialBalance, spread: 0, slippage: 0, commission: 0, session: "ALL", ambiguousHandling: "SKIP", entryGuard: stop.canEnter, onTradeClosed: stop.onTradeClosed };
    const engine = new BreakoutEngine(h4, params); let m1Count = 0; for await (const c of streamCached("M1", fromMs, toMs)) { m1Count++; engine.onM1(c); } if (!m1Count) throw new Error("No M1 candles in selected period");
    engine.finish(); engine.equity[0].time = new Date(fromMs).toISOString(); const daily = summarizeDailyLosses(engine.trades); config.dailyBlockedDays = stop.stats.blockedDays.size; config.dailySkippedSignals = stop.stats.skippedSignals; config.worstDailyLoss = daily.worstDailyLoss; config.consecutiveLosingDays = daily.consecutiveLosingDays; if (m1Meta.gapCount > 0) summary.warnings.push(`M1 data has ${m1Meta.gapCount} time gaps; weekend gaps are normal.`); persistArtifacts(runId, engine.trades, engine.equity); const metrics = computeMetrics(engine.trades, engine.equity, req.initialBalance); metrics.skippedTrades = engine.skippedSignals; metrics.ambiguousTrades = engine.ambiguousSignals; summary.metrics = metrics; summary.config = config; summary.status = "COMPLETED";
  } catch (e) { summary.status = "FAILED"; summary.error = e instanceof Error ? e.message : String(e); }
  summary.finishedAt = new Date().toISOString(); fs.writeFileSync(path.join(dir, "summary.json"), JSON.stringify(summary, null, 2)); upsertIndex(summary); return summary;
}

async function runTrendPullbackH1Local(req: BacktestRequest, runId: string): Promise<RunSummary> {
  const dir = path.join(REPORTS_DIR, runId); ensureDir(dir);
  const summary: RunSummary = { runId, status: "RUNNING", createdAt: new Date().toISOString(), finishedAt: null, error: null, warnings: [], calculationVersion: CALCULATION_VERSION, config: {}, metrics: null };
  try {
    const h1Meta = await ensureCache("H1");
    if (h1Meta.status !== "READY") throw new Error("H1 cache must be READY");
    const fromMs = parseDate("startDate", req.startDate); const toMs = parseDate("endDate", req.endDate) + 24 * 3600_000 - 1;
    if (fromMs < Date.parse(h1Meta.firstDate!) || toMs > Date.parse(h1Meta.lastDate!)) throw new Error("Selected period is outside H1 dataset");
    const cfg = runTrendPullbackH1Request(req, await loadCached("H1", fromMs, toMs));
    const config: StoredConfig = { runId, strategyId: XAU_TREND_PULLBACK_H1_ID, strategyName: XAU_TREND_PULLBACK_H1_NAME, method: XAU_TREND_PULLBACK_H1_NAME, methodName: XAU_TREND_PULLBACK_H1_NAME, lot: cfg.cfg.lot, initialBalance: cfg.cfg.initialBalance, pipSize: PIP_SIZE, pipValuePerLotUSD: PIP_VALUE_PER_LOT_USD, startDate: req.startDate, endDate: req.endDate, requestedStartDate: req.startDate, effectiveTradingStart: cfg.engine.effectiveTradingStart ?? undefined, warmupCandlesUsed: cfg.engine.warmupCandlesUsed, calculationVersion: CALCULATION_VERSION, riskReward: 2, emaFastPeriod: 50, emaSlowPeriod: 200, atrPeriod: 14, warmupCandles: 204, pullbackAtrTolerance: 0.25, trendAtrSeparation: 0.5, swingLookback: 10, swingFractalRadius: 2, swingBufferAtr: 0.1, stopAtrMultiple: 1.5, confirmationBodyMin: 0.5, confirmationCloseTopFraction: 0.75, maxTradesPerDay: 2, maxLossesPerDay: 2 };
    summary.config = config; upsertIndex(summary); fs.writeFileSync(path.join(dir, "config.json"), JSON.stringify(config, null, 2));
    persistArtifacts(runId, cfg.engine.trades, cfg.engine.equity); summary.metrics = computeMetrics(cfg.engine.trades, cfg.engine.equity, req.initialBalance); summary.status = "COMPLETED";
  } catch (e) { summary.status = "FAILED"; summary.error = e instanceof Error ? e.message : String(e); }
  summary.finishedAt = new Date().toISOString(); fs.writeFileSync(path.join(dir, "summary.json"), JSON.stringify(summary, null, 2)); upsertIndex(summary); return summary;
}

export function deleteRun(runId: string): void {
  if (!validRunId(runId) || path.isAbsolute(runId) || runId.includes("..") || runId.includes("\\") || runId.includes("/")) throw new Error("Invalid run ID");
  const summary = readRun(runId); if (!summary) throw new Error("Backtest not found");
  if (summary.status === "RUNNING") throw new Error("RUNNING backtest cannot be deleted");
  const dir = path.join(REPORTS_DIR, runId); const temp = `${dir}.deleting-${Date.now()}`;
  fs.renameSync(dir, temp);
  try { writeIndex(readIndex().filter((r) => r.runId !== runId)); fs.rmSync(temp, { recursive: true, force: true }); }
  catch (e) { if (fs.existsSync(temp) && !fs.existsSync(dir)) fs.renameSync(temp, dir); throw e; }
}

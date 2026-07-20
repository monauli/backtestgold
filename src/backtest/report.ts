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

export function deleteRun(runId: string): void {
  if (!validRunId(runId) || path.isAbsolute(runId) || runId.includes("..") || runId.includes("\\") || runId.includes("/")) throw new Error("Invalid run ID");
  const summary = readRun(runId); if (!summary) throw new Error("Backtest not found");
  if (summary.status === "RUNNING") throw new Error("RUNNING backtest cannot be deleted");
  const dir = path.join(REPORTS_DIR, runId); const temp = `${dir}.deleting-${Date.now()}`;
  fs.renameSync(dir, temp);
  try { writeIndex(readIndex().filter((r) => r.runId !== runId)); fs.rmSync(temp, { recursive: true, force: true }); }
  catch (e) { if (fs.existsSync(temp) && !fs.existsSync(dir)) fs.renameSync(temp, dir); throw e; }
}

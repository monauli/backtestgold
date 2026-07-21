import { NextResponse } from "next/server";
import { DEFAULT_REQUEST, type BacktestRequest } from "@/backtest/types";
import { runBacktest, nextRunId } from "@/backtest/report";
import { BREAKOUT_H4_STRATEGY_ID, getStrategy, XAU_TREND_PULLBACK_H1_STRATEGY_ID } from "@/strategies/registry";
import { getDataStorageMode } from "@/data/repository-factory";
import { getMongoDb, ensureMongoIndexes } from "@/lib/mongodb";
import { nextCloudRunId } from "@/lib/cloud-counter";
import { getBacktestProcessMode } from "@/lib/backtest-process-mode";
import { BREAKOUT_H4_EMA_TREND_ID } from "@/strategies/breakout_h4_ema_trend";
import { BREAKOUT_H4_STOP_AFTER_1_LOSS_ID } from "@/strategies/breakout_h4_stop_after_1_loss";
import { DAILY_PREVIOUS_CANDLE_BREAKOUT_ID, DAILY_PREVIOUS_CANDLE_BREAKOUT_ENTRY_OFFSET } from "@/strategies/daily_previous_candle_breakout";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function parseRequest(body: unknown): BacktestRequest {
  const b = (body ?? {}) as Record<string, unknown>;
  const strategyId = typeof b.strategyId === "string" ? b.strategyId : BREAKOUT_H4_STRATEGY_ID;
  const req: BacktestRequest = { ...DEFAULT_REQUEST, strategyId, lot: strategyId === XAU_TREND_PULLBACK_H1_STRATEGY_ID || strategyId === BREAKOUT_H4_EMA_TREND_ID || strategyId === BREAKOUT_H4_STOP_AFTER_1_LOSS_ID || strategyId === DAILY_PREVIOUS_CANDLE_BREAKOUT_ID ? 0.35 : DEFAULT_REQUEST.lot, entryOffset: strategyId === DAILY_PREVIOUS_CANDLE_BREAKOUT_ID ? DAILY_PREVIOUS_CANDLE_BREAKOUT_ENTRY_OFFSET : undefined };
  if (typeof b.startDate === "string") req.startDate = b.startDate;
  if (typeof b.endDate === "string") req.endDate = b.endDate;
  for (const key of ["breakoutPips", "stopLossPips", "takeProfitPips"] as const) {
    const value = Number(b[key]); if (Number.isFinite(value)) req[key] = value;
  }
  const entryOffset = Number(b.entryOffset);
  if (Number.isFinite(entryOffset)) req.entryOffset = entryOffset;
  if (strategyId === DAILY_PREVIOUS_CANDLE_BREAKOUT_ID && !(Number(req.entryOffset) > 0)) throw new Error("Entry offset must be positive");
  const lot = Number(b.lot);
  if (Number.isFinite(lot)) req.lot = lot;
  const bal = Number(b.initialBalance);
  if (Number.isFinite(bal)) req.initialBalance = bal;
  if (!(req.lot > 0) || !(req.initialBalance > 0))
    throw new Error("Lot and initial balance must be positive");
  return req;
}

export async function POST(request: Request) {
  try {
    const req = parseRequest(await request.json().catch(() => ({})));
    const strategy = getStrategy(req.strategyId!);
    if (!strategy) return NextResponse.json({ error: "Unknown strategy" }, { status: 400 });
    if (strategy.status === "DRAFT") return NextResponse.json({ error: "Aturan XAU Trend Pullback H1 belum lengkap dan belum dapat dijalankan." }, { status: 400 });
    if (getDataStorageMode() === "MONGODB") {
      await ensureMongoIndexes(); const runId = await nextCloudRunId(); const now = new Date();
      await (await getMongoDb()).collection("backtest_jobs").insertOne({ runId, strategyId: req.strategyId, status: "QUEUED", progress: 0, currentStep: "Waiting for worker", errorCode: null, error: null, retryCount: 0, config: req, checkpoint: null, createdAt: now, startedAt: null, completedAt: null });
      return NextResponse.json({ runId, status: "QUEUED", progress: 0, processingUrl: `/backtests/${runId}/processing`, processMode: getBacktestProcessMode() });
    }
    const runId = nextRunId();
    // MVP: run synchronously; summary.json is written incrementally so the
    // status endpoints reflect RUNNING/COMPLETED/FAILED.
    const summary = await runBacktest(req, runId);
    if (summary.status === "FAILED") {
      return NextResponse.json(
        { runId, status: summary.status, error: summary.error },
        { status: 422 }
      );
    }
    return NextResponse.json({ runId, status: summary.status, progress: summary.status === "COMPLETED" ? 100 : 0, processingUrl: `/backtests/${runId}/processing` });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 400 }
    );
  }
}

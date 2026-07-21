import { NextResponse } from "next/server";
import { getDataStorageMode } from "@/data/repository-factory";
import { getMongoDb, ensureMongoIndexes } from "@/lib/mongodb";
import { nextCloudBatchId } from "@/lib/cloud-counter";
import { buildBatchGrid, parseGridValues } from "@/lib/batch-grid";
import { getBacktestProcessMode } from "@/lib/backtest-process-mode";
import { XAU_TREND_PULLBACK_H1_ID } from "@/strategies/xau_trend_pullback_h1/config";
import { BREAKOUT_H4_EMA_TREND_ID } from "@/strategies/breakout_h4_ema_trend";
import { BREAKOUT_H4_STOP_AFTER_1_LOSS_ID } from "@/strategies/breakout_h4_stop_after_1_loss";
import { DAILY_PREVIOUS_CANDLE_BREAKOUT_ID, DAILY_PREVIOUS_CANDLE_BREAKOUT_ENTRY_OFFSET } from "@/strategies/daily_previous_candle_breakout";

export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    if (getDataStorageMode() !== "MONGODB") return NextResponse.json({ error: "BATCH_REQUIRES_MONGODB_MODE" }, { status: 409 });
    const body = await request.json(); const strategyId = String(body.strategyId || "xau_h4_breakout"); const startDate = String(body.startDate || "2022-01-03"); const endDate = String(body.endDate || ""); const daily = strategyId === DAILY_PREVIOUS_CANDLE_BREAKOUT_ID; const lot = Number(body.lot || (strategyId === XAU_TREND_PULLBACK_H1_ID || strategyId === BREAKOUT_H4_EMA_TREND_ID || strategyId === BREAKOUT_H4_STOP_AFTER_1_LOSS_ID || daily ? 0.35 : 0.4)); const initialBalance = Number(body.initialBalance || 10000); const entryOffset = Number(body.entryOffset || DAILY_PREVIOUS_CANDLE_BREAKOUT_ENTRY_OFFSET);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate) || startDate > endDate || !(lot > 0) || !(initialBalance > 0)) throw new Error("INVALID_BATCH_CONFIG");
    await ensureMongoIndexes(); const db = await getMongoDb(); const timeframe = daily ? "D1" : strategyId === XAU_TREND_PULLBACK_H1_ID ? "H1" : { $in: ["H4", "M1"] }; const states = await db.collection("data_sync_state").find({ symbol: "XAUUSD", timeframe }).toArray(); if (states.length !== (strategyId === XAU_TREND_PULLBACK_H1_ID || daily ? 1 : 2) || states.some((x) => x.status !== "READY")) throw new Error(daily ? "D1_DATA_NOT_READY" : strategyId === XAU_TREND_PULLBACK_H1_ID ? "H1_DATA_NOT_READY" : "H4_M1_DATA_NOT_READY"); const batchId = await nextCloudBatchId(); const combinations = strategyId === XAU_TREND_PULLBACK_H1_ID ? [{ combinationId: `${batchId}-C001`, strategyId }] : daily ? [{ combinationId: `${batchId}-C001`, strategyId, entryOffset, stopLossPips: Number(body.stopLossPips || 200), takeProfitPips: Number(body.takeProfitPips || 400) }] : buildBatchGrid({ breakoutPips: parseGridValues(String(body.breakoutPips || "5,10,15,20,25")), stopLossPips: parseGridValues(String(body.stopLossPips || "150,200,250")), takeProfitPips: parseGridValues(String(body.takeProfitPips || "300,400,500")) }, batchId); const now = new Date(); await db.collection("batch_backtest_jobs").insertOne({ batchId, strategyId, status: "QUEUED", totalCombinations: combinations.length, completedCombinations: 0, failedCombinations: 0, progress: 0, currentCombination: 1, currentParameters: combinations[0], config: { strategyId, startDate, endDate, lot, initialBalance, entryOffset, combinations }, error: null, errorCode: null, createdAt: now, startedAt: null, completedAt: null });
    return NextResponse.json({ batchId, status: "QUEUED", totalCombinations: combinations.length, processingUrl: `/batch-backtest/${batchId}/processing`, processMode: getBacktestProcessMode() });
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "INVALID_BATCH_CONFIG" }, { status: 400 }); }
}

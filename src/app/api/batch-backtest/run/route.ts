import { NextResponse } from "next/server";
import { getDataStorageMode } from "@/data/repository-factory";
import { getMongoDb, ensureMongoIndexes } from "@/lib/mongodb";
import { nextCloudBatchId } from "@/lib/cloud-counter";
import { buildBatchGrid, parseGridValues } from "@/lib/batch-grid";
import { getBacktestProcessMode } from "@/lib/backtest-process-mode";

export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    if (getDataStorageMode() !== "MONGODB") return NextResponse.json({ error: "BATCH_REQUIRES_MONGODB_MODE" }, { status: 409 });
    const body = await request.json(); const startDate = String(body.startDate || "2022-01-03"); const endDate = String(body.endDate || ""); const lot = Number(body.lot || 0.4); const initialBalance = Number(body.initialBalance || 10000);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate) || startDate > endDate || !(lot > 0) || !(initialBalance > 0)) throw new Error("INVALID_BATCH_CONFIG");
    await ensureMongoIndexes(); const db = await getMongoDb(); const states = await db.collection("data_sync_state").find({ symbol: "XAUUSD", timeframe: { $in: ["H4", "M1"] } }).toArray(); if (states.length !== 2 || states.some((x) => x.status !== "READY")) throw new Error("H4_M1_DATA_NOT_READY"); const batchId = await nextCloudBatchId(); const combinations = buildBatchGrid({ breakoutPips: parseGridValues(String(body.breakoutPips || "5,10,15,20,25")), stopLossPips: parseGridValues(String(body.stopLossPips || "150,200,250")), takeProfitPips: parseGridValues(String(body.takeProfitPips || "300,400,500")) }, batchId); const now = new Date(); await db.collection("batch_backtest_jobs").insertOne({ batchId, strategyId: "xau_h4_breakout", status: "QUEUED", totalCombinations: combinations.length, completedCombinations: 0, failedCombinations: 0, progress: 0, currentCombination: 1, currentParameters: combinations[0], config: { strategyId: "xau_h4_breakout", startDate, endDate, lot, initialBalance, combinations }, errorCode: null, error: null, createdAt: now, startedAt: null, completedAt: null });
    return NextResponse.json({ batchId, status: "QUEUED", totalCombinations: combinations.length, processingUrl: `/batch-backtest/${batchId}/processing`, processMode: getBacktestProcessMode() });
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "INVALID_BATCH_CONFIG" }, { status: 400 }); }
}

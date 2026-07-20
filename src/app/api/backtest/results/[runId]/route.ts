import { NextResponse } from "next/server";
import { readRun, readTrades, readEquity } from "@/backtest/report";
import { deleteRun } from "@/backtest/report";
import { getDataStorageMode } from "@/data/repository-factory";
import { getMongoDb } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { runId: string } }
) {
  if (getDataStorageMode() === "MONGODB") { const db = await getMongoDb(); const run = await db.collection("backtest_runs").findOne({ runId: params.runId }); if (!run) return NextResponse.json({ error: "Run not found" }, { status: 404 }); const trades = await db.collection("backtest_trades").find({ runId: params.runId }, { projection: { _id: 0, runId: 0 } }).sort({ entryTime: 1 }).toArray(); const equity = await db.collection("backtest_equity").find({ runId: params.runId }, { projection: { _id: 0, runId: 0 } }).sort({ time: 1 }).toArray(); return NextResponse.json({ summary: { runId: run.runId, status: "COMPLETED", createdAt: run.createdAt, finishedAt: run.completedAt, error: null, warnings: [], calculationVersion: run.calculationVersion, config: run.config, metrics: run.summary }, trades, equity }); }
  const summary = readRun(params.runId);
  if (!summary) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }
  return NextResponse.json({
    summary,
    trades: readTrades(params.runId),
    equity: readEquity(params.runId),
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: { runId: string } }
) {
  try {
    if (getDataStorageMode() === "MONGODB") { if (!/^backtest\d{3}XAU$/.test(params.runId)) throw new Error("Invalid run ID"); const db = await getMongoDb(); const result = { run: (await db.collection("backtest_runs").deleteOne({ runId: params.runId })).deletedCount, job: (await db.collection("backtest_jobs").deleteMany({ runId: params.runId })).deletedCount, trades: (await db.collection("backtest_trades").deleteMany({ runId: params.runId })).deletedCount, equity: (await db.collection("backtest_equity").deleteMany({ runId: params.runId })).deletedCount }; return NextResponse.json({ ok: true, runId: params.runId, deleted: result }); }
    deleteRun(params.runId);
    return NextResponse.json({ ok: true, runId: params.runId });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}

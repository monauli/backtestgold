import { notFound, redirect } from "next/navigation";
import { readRun, readTrades, readEquity } from "@/backtest/report";
import ResultDetail from "./result-detail";
import { getDataStorageMode } from "@/data/repository-factory";
import { getMongoDb } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

export default async function ResultPage({ params }: { params: { runId: string } }) {
  let summary = readRun(params.runId); let trades = readTrades(params.runId); let equity = readEquity(params.runId);
  if (getDataStorageMode() === "MONGODB") { const db = await getMongoDb(); const job = await db.collection("backtest_jobs").findOne({ runId: params.runId }, { projection: { status: 1 } }); if (job && job.status !== "COMPLETED") redirect(`/backtests/${params.runId}/processing`); const run = await db.collection("backtest_runs").findOne({ runId: params.runId }); if (run) { summary = { runId: run.runId, status: "COMPLETED", createdAt: run.createdAt, finishedAt: run.completedAt, error: null, warnings: [], calculationVersion: run.calculationVersion, config: run.config, metrics: run.summary } as never; trades = await db.collection("backtest_trades").find({ runId: params.runId }, { projection: { _id: 0, runId: 0 } }).sort({ entryTime: 1 }).toArray() as never; equity = await db.collection("backtest_equity").find({ runId: params.runId }, { projection: { _id: 0, runId: 0 } }).sort({ time: 1 }).toArray() as never; } }
  if (!summary) notFound();
  return (
    <ResultDetail
      summary={summary}
      trades={trades}
      equity={equity}
    />
  );
}

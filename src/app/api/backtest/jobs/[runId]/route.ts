import { NextResponse } from "next/server";
import { getDataStorageMode } from "@/data/repository-factory";
import { getMongoDb } from "@/lib/mongodb";
import { readRun } from "@/backtest/report";

export const dynamic = "force-dynamic";
const validRunId = (runId: string) => /^backtest\d{3}XAU$/.test(runId);

export async function GET(_request: Request, { params }: { params: { runId: string } }) {
  if (!validRunId(params.runId)) return NextResponse.json({ error: "INVALID_RUN_ID" }, { status: 400 });
  if (getDataStorageMode() !== "MONGODB") {
    const summary = readRun(params.runId);
    if (!summary) return NextResponse.json({ error: "JOB_NOT_FOUND" }, { status: 404 });
    return NextResponse.json({ runId: params.runId, status: summary.status, progress: summary.status === "COMPLETED" ? 100 : 0, currentStep: summary.status, errorCode: summary.status === "FAILED" ? "LOCAL_BACKTEST_FAILED" : null, error: summary.error, createdAt: summary.createdAt, startedAt: null, completedAt: summary.finishedAt });
  }
  const job = await (await getMongoDb()).collection("backtest_jobs").findOne({ runId: params.runId }, { projection: { _id: 0, runId: 1, strategyId: 1, config: 1, status: 1, progress: 1, currentStep: 1, errorCode: 1, error: 1, retryCount: 1, createdAt: 1, startedAt: 1, completedAt: 1 } });
  if (!job) return NextResponse.json({ error: "JOB_NOT_FOUND" }, { status: 404 });
  return NextResponse.json(job);
}

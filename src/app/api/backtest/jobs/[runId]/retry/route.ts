import { NextResponse } from "next/server";
import { getDataStorageMode } from "@/data/repository-factory";
import { getMongoDb } from "@/lib/mongodb";

export const dynamic = "force-dynamic";
export async function POST(_request: Request, { params }: { params: { runId: string } }) {
  if (!/^backtest\d{3}XAU$/.test(params.runId)) return NextResponse.json({ error: "INVALID_RUN_ID" }, { status: 400 });
  if (getDataStorageMode() !== "MONGODB") return NextResponse.json({ error: "RETRY_NOT_AVAILABLE_IN_LOCAL_MODE" }, { status: 409 });
  const result = await (await getMongoDb()).collection("backtest_jobs").updateOne({ runId: params.runId, status: "FAILED" }, { $set: { status: "QUEUED", progress: 0, currentStep: "Waiting for worker", errorCode: null, error: null, completedAt: null } });
  if (!result.matchedCount) return NextResponse.json({ error: "JOB_NOT_FAILED_OR_NOT_FOUND" }, { status: 409 });
  return NextResponse.json({ runId: params.runId, status: "QUEUED", processingUrl: `/backtests/${params.runId}/processing` });
}

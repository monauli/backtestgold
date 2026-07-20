import { getDataStorageMode } from "@/data/repository-factory";
import { getMongoDb } from "@/lib/mongodb";
import { getBacktestProcessMode } from "@/lib/backtest-process-mode";
import ProcessingClient from "./processing-client";

export const dynamic = "force-dynamic";
export default async function ProcessingPage({ params }: { params: { runId: string } }) {
  let initial: Record<string, unknown> = { runId: params.runId, status: "QUEUED", progress: 0, currentStep: "Waiting for worker" };
  if (getDataStorageMode() === "MONGODB") {
    const job = await (await getMongoDb()).collection("backtest_jobs").findOne({ runId: params.runId }, { projection: { _id: 0, runId: 1, strategyId: 1, config: 1, status: 1, progress: 1, currentStep: 1, errorCode: 1, error: 1, retryCount: 1, createdAt: 1, startedAt: 1, completedAt: 1 } });
    if (job) initial = job as Record<string, unknown>; else initial = { runId: params.runId, status: "NOT_FOUND", progress: 0 };
  }
  return <ProcessingClient runId={params.runId} initial={initial} inlineEnabled={getBacktestProcessMode() === "INLINE" && getDataStorageMode() === "MONGODB"} />;
}

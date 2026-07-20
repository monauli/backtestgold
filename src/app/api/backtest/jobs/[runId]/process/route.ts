import { NextResponse } from "next/server";
import { getDataStorageMode } from "@/data/repository-factory";
import { processOneCloudBacktest } from "@/lib/cloud-backtest-worker";
import { getBacktestProcessMode } from "@/lib/backtest-process-mode";

export const dynamic = "force-dynamic";
export async function POST(_request: Request, { params }: { params: { runId: string } }) {
  if (!/^backtest\d{3}XAU$/.test(params.runId)) return NextResponse.json({ error: "INVALID_RUN_ID" }, { status: 400 });
  if (getDataStorageMode() !== "MONGODB" || getBacktestProcessMode() !== "INLINE") return NextResponse.json({ error: "INLINE_PROCESSING_DISABLED" }, { status: 409 });
  const result = await processOneCloudBacktest(params.runId);
  return NextResponse.json(result, { status: result.status === "FAILED" ? 500 : 200 });
}

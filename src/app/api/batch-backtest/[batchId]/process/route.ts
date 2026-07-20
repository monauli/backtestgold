import { NextResponse } from "next/server";
import { getBacktestProcessMode } from "@/lib/backtest-process-mode";
import { processOneBatch } from "@/lib/batch-backtest-worker";
export const dynamic = "force-dynamic";
export async function POST(_r: Request, { params }: { params: { batchId: string } }) { if (!/^batch\d{3}XAU$/.test(params.batchId)) return NextResponse.json({ error: "INVALID_BATCH_ID" }, { status: 400 }); if (getBacktestProcessMode() !== "INLINE") return NextResponse.json({ error: "INLINE_PROCESSING_DISABLED" }, { status: 409 }); const result = await processOneBatch(params.batchId); return NextResponse.json(result, { status: result.status === "FAILED" ? 500 : 200 }); }

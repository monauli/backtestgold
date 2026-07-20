import { NextResponse } from "next/server";
import { getMongoDb } from "@/lib/mongodb";
export const dynamic = "force-dynamic";
export async function GET(_r: Request, { params }: { params: { batchId: string } }) { if (!/^batch\d{3}XAU$/.test(params.batchId)) return NextResponse.json({ error: "INVALID_BATCH_ID" }, { status: 400 }); const job = await (await getMongoDb()).collection("batch_backtest_jobs").findOne({ batchId: params.batchId }, { projection: { _id: 0 } }); if (!job) return NextResponse.json({ error: "BATCH_NOT_FOUND" }, { status: 404 }); const best = await (await getMongoDb()).collection("batch_backtest_results").find({ batchId: params.batchId, status: "COMPLETED" }).sort({ overallScore: -1 }).limit(1).next(); return NextResponse.json({ ...job, currentBest: best }); }

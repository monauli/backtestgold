import { NextResponse } from "next/server";
import { processOneCloudBacktest } from "@/lib/cloud-backtest-worker";
import { processOneBatch } from "@/lib/batch-backtest-worker";
import { getMongoDb } from "@/lib/mongodb";
export const dynamic = "force-dynamic";
export async function POST(request: Request) { const secret = process.env.CRON_SECRET; if (!secret) return NextResponse.json({ status: "CRON_SECRET_NOT_CONFIGURED" }, { status: 500 }); if (request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 }); if (process.env.DATA_STORAGE_MODE !== "MONGODB") return NextResponse.json({ status: "LOCAL_MODE_NO_CLOUD_WORKER" }); const result = await processOneCloudBacktest(); if (result.status !== "COMPLETED" && result.status !== "FAILED") { const batch = await (await getMongoDb()).collection("batch_backtest_jobs").findOne({ status: { $in: ["QUEUED", "RUNNING"] } }, { projection: { batchId: 1 } }); if (batch) return NextResponse.json(await processOneBatch(batch.batchId)); } return NextResponse.json(result, { status: result.status === "FAILED" ? 500 : 200 }); }

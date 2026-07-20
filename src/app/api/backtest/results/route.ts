import { NextResponse } from "next/server";
import { readIndex } from "@/backtest/report";
import { getDataStorageMode } from "@/data/repository-factory";
import { getMongoDb } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

export async function GET() {
  if (getDataStorageMode() === "MONGODB") { const docs = await (await getMongoDb()).collection("backtest_runs").find({}).sort({ createdAt: -1 }).toArray(); return NextResponse.json(docs.map((d) => ({ runId: d.runId, status: "COMPLETED", createdAt: d.createdAt, finishedAt: d.completedAt, error: null, warnings: [], calculationVersion: d.calculationVersion, config: d.config, metrics: d.summary }))); }
  return NextResponse.json(readIndex());
}

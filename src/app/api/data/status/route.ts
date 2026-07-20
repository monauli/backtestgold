import { NextResponse } from "next/server";
import { getDataStatus } from "@/data/status";
import { getDataStorageMode } from "@/data/repository-factory";
import { getMongoDb } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    if (getDataStorageMode() === "MONGODB") { const states = await (await getMongoDb()).collection("data_sync_state").find({ symbol: "XAUUSD" }).toArray(); const empty = (timeframe: string) => ({ status: "NOT_INDEXED", timeframe, sourceFile: "MongoDB Atlas", candleCount: 0, firstDate: null, lastDate: null, indexedAt: "" }); const make = (timeframe: string) => { const s = states.find((x) => x.timeframe === timeframe); return { ...empty(timeframe), status: s?.status ?? "NOT_IMPORTED", candleCount: s?.candleCount ?? 0, firstDate: s?.firstTimestamp?.toISOString() ?? null, lastDate: s?.lastClosedTimestamp?.toISOString() ?? null, indexedAt: s?.lastSuccessAt?.toISOString() ?? "", error: s?.lastError ?? undefined }; }; return NextResponse.json({ generatedAt: new Date().toISOString(), h4: make("H4"), h1: make("H1"), m1: make("M1") }); }
    return NextResponse.json(getDataStatus());
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}

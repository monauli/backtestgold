import { NextResponse } from "next/server";
import { getDataStorageMode } from "@/data/repository-factory";
import { classifyMongoError, getMongoDatabaseName, getMongoDb } from "@/lib/mongodb";
import { isProviderConfigured } from "@/lib/xau-provider";
import type { CloudTimeframe, DataSyncState } from "@/lib/cloud-types";

export const dynamic = "force-dynamic";
export async function GET() {
  const mode = getDataStorageMode(); let mongoStatus = mode === "MONGODB" ? "NOT_CONFIGURED" : "DISABLED"; const sync: Partial<Record<CloudTimeframe, DataSyncState>> = {};
  let errorCode: string | undefined;
  const collections = { candles: false, data_sync_state: false, backtest_runs: false };
  if (mode === "MONGODB") {
    try {
      const db = await getMongoDb(); mongoStatus = "CONNECTED";
      const names = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map((x) => x.name));
      collections.candles = names.has("candles"); collections.data_sync_state = names.has("data_sync_state"); collections.backtest_runs = names.has("backtest_runs");
      const states = await db.collection<DataSyncState>("data_sync_state").find({ symbol: "XAUUSD" }).toArray();
      for (const state of states) sync[state.timeframe] = { ...state, count: state.candleCount, firstTimestamp: state.firstTimestamp ?? null, lastTimestamp: state.lastClosedTimestamp ?? null } as DataSyncState;
    } catch (error) { mongoStatus = "ERROR"; errorCode = classifyMongoError(error); }
  }
  return NextResponse.json({ app: "OK", dataStorageMode: mode, mongodb: mongoStatus, database: getMongoDatabaseName(), collections, sync, providerConfigured: isProviderConfigured(), ...(errorCode ? { errorCode } : {}), serverTime: new Date().toISOString() });
}

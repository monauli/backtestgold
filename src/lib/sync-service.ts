import { getMongoDb, ensureMongoIndexes } from "./mongodb";
import { getXauMarketDataProvider } from "./xau-provider";
import type { CloudTimeframe, DataSyncState } from "./cloud-types";
import { MongoCandleRepository } from "@/data/mongo-candle-repository";

const MIN = 60_000;
export async function syncTimeframe(timeframe: CloudTimeframe) {
  await ensureMongoIndexes(); const db = await getMongoDb(); const state = db.collection<DataSyncState>("data_sync_state"); const now = new Date();
  const provider = getXauMarketDataProvider();
  if (!provider) { await state.updateOne({ symbol: "XAUUSD", timeframe }, { $set: { symbol: "XAUUSD", timeframe, providerId: null, status: "PROVIDER_NOT_CONFIGURED", lastAttemptAt: now, lastError: "XAU_DATA_PROVIDER is not configured", updatedAt: now }, $setOnInsert: { firstTimestamp: null, lastClosedTimestamp: null, candleCount: 0, lastSuccessAt: null, insertedCount: 0, updatedCount: 0 } }, { upsert: true }); return { timeframe, status: "PROVIDER_NOT_CONFIGURED" as const } as const; }
  const lock = db.collection("data_sync_locks"); const lockUntil = new Date(Date.now() + 5 * 60_000); const acquired = await lock.findOneAndUpdate({ symbol: "XAUUSD", timeframe, $or: [{ lockedUntil: { $lt: now } }, { lockedUntil: { $exists: false } }] }, { $set: { symbol: "XAUUSD", timeframe, lockedUntil: lockUntil } }, { upsert: true, returnDocument: "after" });
  if (!acquired) return { timeframe, status: "LOCKED" as const };
  try {
    const previous = await state.findOne({ symbol: "XAUUSD", timeframe }); const start = previous?.lastClosedTimestamp ? new Date(previous.lastClosedTimestamp.getTime() - MIN) : new Date("2022-01-01T00:00:00.000Z");
    await state.updateOne({ symbol: "XAUUSD", timeframe }, { $set: { status: "SYNCING", providerId: provider.id, lastAttemptAt: now, lastError: null } }, { upsert: true });
    const candles = (await provider.fetchClosedCandles({ symbol: "XAUUSD", timeframe, startTime: start, endTime: now })).map((c) => ({ ...c, timeframe })); const repo = new MongoCandleRepository(); const result = await repo.upsertCandles(candles, provider.id); const range = await repo.getAvailableRange("XAUUSD", timeframe); const last = range.lastTimestamp;
    await state.updateOne({ symbol: "XAUUSD", timeframe }, { $set: { status: "READY", providerId: provider.id, firstTimestamp: range.firstTimestamp, lastClosedTimestamp: last, candleCount: range.count, lastSuccessAt: new Date(), insertedCount: result.inserted, updatedCount: result.updated, lastError: null } }, { upsert: true });
    return { timeframe, status: "SUCCESS" as const, ...result, lastClosedTimestamp: last };
  } catch (error) { await state.updateOne({ symbol: "XAUUSD", timeframe }, { $set: { status: "FAILED", lastError: error instanceof Error ? error.message : String(error), lastAttemptAt: new Date() } }, { upsert: true }); return { timeframe, status: "FAILED" as const, error: error instanceof Error ? error.message : String(error) }; }
  finally { await lock.deleteOne({ symbol: "XAUUSD", timeframe }); }
}

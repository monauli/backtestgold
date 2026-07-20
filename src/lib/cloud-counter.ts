import { getMongoDb, ensureMongoIndexes } from "./mongodb";
type Counter = { key: string; lastNumber?: number };
export async function nextCloudRunId() { await ensureMongoIndexes(); const doc = await (await getMongoDb()).collection<Counter>("backtest_counters").findOneAndUpdate({ key: "xau_backtest" }, { $inc: { lastNumber: 1 }, $set: { updatedAt: new Date() } }, { upsert: true, returnDocument: "after" }); const number = doc?.lastNumber ?? 1; return `backtest${String(number).padStart(3, "0")}XAU`; }

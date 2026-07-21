import type { Candle } from "@/backtest/types";
import { getMongoDb } from "@/lib/mongodb";
import type { CloudTimeframe, UpsertResult } from "@/lib/cloud-types";
import type { CandleRepository } from "./repository";

export class MongoCandleRepository implements CandleRepository {
  async getAvailableRange(symbol: string, timeframe: CloudTimeframe) {
    const collection = (await getMongoDb()).collection("candles");
    const [first, last, count] = await Promise.all([
      collection.findOne({ symbol, timeframe }, { sort: { timestamp: 1 }, projection: { timestamp: 1 } }),
      collection.findOne({ symbol, timeframe }, { sort: { timestamp: -1 }, projection: { timestamp: 1 } }),
      collection.countDocuments({ symbol, timeframe }),
    ]);
    return { firstTimestamp: first?.timestamp ?? null, lastTimestamp: last?.timestamp ?? null, count };
  }
  async getCandles(symbol: string, timeframe: CloudTimeframe, startDate: Date, endDate: Date) {
    const docs = await (await getMongoDb()).collection("candles").find({ symbol, timeframe, timestamp: { $gte: startDate, $lte: endDate }, isClosed: true }).sort({ timestamp: 1 }).toArray();
    return docs.map((d) => ({ timestamp: d.timestamp.getTime(), open: d.open, high: d.high, low: d.low, close: d.close, ...(typeof d.volume === "number" ? { volume: d.volume } : {}) }));
  }
  async getCandlesExclusive(symbol: string, timeframe: CloudTimeframe, startDate: Date, endDateExclusive: Date) {
    const docs = await (await getMongoDb()).collection("candles").find(
      { symbol, timeframe, timestamp: { $gte: startDate, $lt: endDateExclusive }, isClosed: true },
      { projection: { _id: 0, timestamp: 1, open: 1, high: 1, low: 1, close: 1, volume: 1, tickVolume: 1 }, hint: { symbol: 1, timeframe: 1, timestamp: 1 }, maxTimeMS: 30000 },
    ).sort({ timestamp: 1 }).toArray();
    return docs.map((d) => ({ timestamp: d.timestamp.getTime(), open: d.open, high: d.high, low: d.low, close: d.close, ...(typeof d.volume === "number" ? { volume: d.volume } : {}) }));
  }
  async upsertCandles(candles: Candle[], source = "unknown"): Promise<UpsertResult> {
    if (!candles.length) return { inserted: 0, updated: 0, skipped: 0, failed: 0 };
    const now = new Date(); const collection = (await getMongoDb()).collection("candles");
    const operations = candles.map((c) => ({ updateOne: { filter: { symbol: "XAUUSD", timeframe: (c as Candle & { timeframe?: CloudTimeframe }).timeframe, timestamp: new Date(c.timestamp) }, update: { $set: { open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume ?? null, source, isClosed: true, updatedAt: now }, $setOnInsert: { symbol: "XAUUSD", timeframe: (c as Candle & { timeframe?: CloudTimeframe }).timeframe, timestamp: new Date(c.timestamp), createdAt: now } }, upsert: true } }));
    const result = await collection.bulkWrite(operations, { ordered: false });
    return { inserted: result.upsertedCount, updated: result.modifiedCount, skipped: result.matchedCount - result.modifiedCount, failed: 0 };
  }
}

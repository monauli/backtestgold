import type { Candle } from "@/backtest/types";
import { cacheStatus, loadCached } from "./cache";
import type { CandleRepository } from "./repository";
import type { CloudTimeframe, UpsertResult } from "@/lib/cloud-types";

export class LocalCandleRepository implements CandleRepository {
  async getAvailableRange(_symbol: string, timeframe: CloudTimeframe) {
    const meta = cacheStatus(timeframe); return { firstTimestamp: meta.firstDate ? new Date(meta.firstDate) : null, lastTimestamp: meta.lastDate ? new Date(meta.lastDate) : null, count: meta.candleCount };
  }
  async getCandles(_symbol: string, timeframe: CloudTimeframe, startDate: Date, endDate: Date) { return loadCached(timeframe, startDate.getTime(), endDate.getTime()); }
  async upsertCandles(candles: Candle[], source?: string): Promise<UpsertResult> { void candles; void source; throw new Error("LOCAL_REPOSITORY_IS_READ_ONLY_FOR_CLOUD_IMPORT"); }
}

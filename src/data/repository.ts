import type { Candle } from "@/backtest/types";
import type { CloudTimeframe, UpsertResult } from "@/lib/cloud-types";

export type CandleRepository = {
  getAvailableRange(symbol: string, timeframe: CloudTimeframe): Promise<{ firstTimestamp: Date | null; lastTimestamp: Date | null; count: number }>;
  getCandles(symbol: string, timeframe: CloudTimeframe, startDate: Date, endDate: Date): Promise<Candle[]>;
  upsertCandles(candles: Candle[], source?: string): Promise<UpsertResult>;
};

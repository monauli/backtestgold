import type { Candle } from "@/backtest/types";
import type { CloudTimeframe } from "./cloud-types";
export type XauMarketDataProvider = { id: string; fetchClosedCandles(params: { symbol: "XAUUSD"; timeframe: CloudTimeframe; startTime: Date; endTime: Date; limit?: number }): Promise<Candle[]> };
export function getXauMarketDataProvider(): XauMarketDataProvider | null { return null; }
export function isProviderConfigured() { return Boolean(process.env.XAU_DATA_PROVIDER); }

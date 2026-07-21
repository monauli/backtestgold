export type CloudTimeframe = "M1" | "H1" | "H4" | "D1";
export type CandleDocument = {
  symbol: "XAUUSD"; timeframe: CloudTimeframe; timestamp: Date;
  open: number; high: number; low: number; close: number; volume: number | null;
  source: string; isClosed: boolean; createdAt: Date; updatedAt: Date;
};
export type UpsertResult = { inserted: number; updated: number; skipped: number; failed: number };
export type DataSyncState = {
  symbol: "XAUUSD"; timeframe: CloudTimeframe; providerId: string | null;
  status: "READY" | "SYNCING" | "FAILED" | "PROVIDER_NOT_CONFIGURED";
  firstTimestamp: Date | null; lastClosedTimestamp: Date | null; candleCount: number;
  lastAttemptAt: Date | null; lastSuccessAt: Date | null; lastError: string | null;
  insertedCount: number; updatedCount: number; source?: "MT5_CSV"; importFrom?: Date;
  lastProcessedTimestamp?: Date | null; scannedCount?: number; invalidCount?: number; skippedCount?: number;
};

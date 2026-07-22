export type Candle = {
  timestamp: number; // epoch ms (data timezone treated as UTC)
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};

export type Session = "ALL" | "ASIA" | "LONDON" | "NEW_YORK";
export type AmbiguousHandling = "SKIP" | "CONSERVATIVE" | "OPTIMISTIC";

/** User-facing flexible breakout configuration. */
export type BacktestRequest = {
  strategyId?: string;
  startDate: string;
  endDate: string;
  breakoutPips: number;
  stopLossPips: number;
  takeProfitPips: number;
  lot: number;
  initialBalance: number;
  strategyName?: string;
  riskReward?: number;
  emaFastPeriod?: number;
  emaSlowPeriod?: number;
  atrPeriod?: number;
  warmupCandles?: number;
  requestedStartDate?: string;
  effectiveTradingStart?: string;
  warmupCandlesUsed?: number;
  pullbackAtrTolerance?: number;
  trendAtrSeparation?: number;
  swingLookback?: number;
  swingFractalRadius?: number;
  swingBufferAtr?: number;
  stopAtrMultiple?: number;
  confirmationBodyMin?: number;
  confirmationCloseTopFraction?: number;
  maxTradesPerDay?: number;
  maxLossesPerDay?: number;
  entryOffset?: number;
  previousDailyHigh?: number;
  previousDailyLow?: number;
  buyStop?: number;
  sellStop?: number;
  noTriggerDays?: number;
  pendingExpiredDays?: number;
  dailyAmbiguousCandles?: number;
  stopBufferPips?: number; minimumStopDistancePips?: number; maximumStopDistancePips?: number; maximumEntryDistanceFromLevelPips?: number; maximumTradesPerSession?: number; cooldownBars?: number; useProxyVwapBias?: boolean; spreadPips?: number; slippagePips?: number; commissionPerLot?: number; executionMode?: "conservative"; orderFlowSource?: "none"; proxyOrderFlowEnabled?: boolean; orderFlowConfirmationRequired?: boolean; activeWindow?: "JAKARTA_07_00_23_59";
};

export type BacktestTemplate = {
  strategyId: string;
  templateId: string;
  templateName: string;
  config?: Partial<BacktestRequest>;
  breakoutPips: number;
  stopLossPips: number;
  takeProfitPips: number;
  lot: number;
  initialBalance: number;
  createdAt: string;
  updatedAt: string;
};

export const DEFAULT_REQUEST: BacktestRequest = {
  startDate: "",
  endDate: "",
  breakoutPips: 100,
  stopLossPips: 200,
  takeProfitPips: 400,
  lot: 0.4,
  initialBalance: 10000,
};

/** Full engine parameters, resolved from the method registry — not user-editable. */
export type EngineParams = {
  breakoutDistance: number; // price units
  stopLossDistance: number; // price units
  takeProfitDistance: number; // price units
  lot: number;
  initialBalance: number;
  spread: number;
  slippage: number;
  commission: number; // USD per trade
  session: Session;
  ambiguousHandling: AmbiguousHandling;
  entryFilter?: (direction: "BUY" | "SELL", referenceCandle: Candle) => boolean;
  entryGuard?: (timestamp: number) => boolean;
  onTradeClosed?: (trade: BacktestTrade) => void;
  tradeManagement?: { triggerDistance: number; movedStopDistance: number };
};

/** Stored in config.json for every run. */
export type StoredConfig = {
  runId?: string;
  method?: string;
  methodId?: string;
  methodName: string;
  lot: number;
  initialBalance: number;
  pipSize: number;
  pipValuePerLotUSD: number;
  breakoutPips?: number;
  stopLossPips?: number;
  takeProfitPips?: number;
  riskReward?: number;
  startDate: string;
  endDate: string;
  calculationVersion: string;
  strategyId?: string;
  strategyName?: string;
  breakoutPriceDistance?: number;
  stopLossPriceDistance?: number;
  takeProfitPriceDistance?: number;
  emaFastPeriod?: number;
  emaSlowPeriod?: number;
  atrPeriod?: number;
  warmupCandles?: number;
  requestedStartDate?: string;
  effectiveTradingStart?: string;
  warmupCandlesUsed?: number;
  pullbackAtrTolerance?: number;
  trendAtrSeparation?: number;
  swingLookback?: number;
  swingFractalRadius?: number;
  swingBufferAtr?: number;
  stopAtrMultiple?: number;
  confirmationBodyMin?: number;
  confirmationCloseTopFraction?: number;
  maxTradesPerDay?: number;
  maxLossesPerDay?: number;
  dailyStopRule?: string;
  dailyStopTimezone?: string;
  dailyBlockedDays?: number;
  dailySkippedSignals?: number;
  worstDailyLoss?: number;
  consecutiveLosingDays?: number;
  entryOffset?: number;
  previousDailyHigh?: number;
  previousDailyLow?: number;
  buyStop?: number;
  sellStop?: number;
  noTriggerDays?: number;
  pendingExpiredDays?: number;
  dailyAmbiguousCandles?: number;
};

export type TradeResult =
  | "WIN"
  | "LOSS"
  | "BREAKEVEN"
  | "AMBIGUOUS"
  | "SKIPPED"
  | "OPEN_AT_END";

export type BacktestTrade = {
  id: string;
  direction: "BUY" | "SELL";
  referenceH4Time: string;
  referenceHigh: number;
  referenceLow: number;
  breakoutLevel: number;
  entryTime: string;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  exitTime: string | null;
  exitPrice: number | null;
  result: TradeResult;
  pips: number; // signed pip movement of the trade
  grossProfit: number; // USD
  commission: number; // USD
  netProfit: number; // USD
  balanceBefore: number;
  balanceAfter: number;
};

export type EquityPoint = { time: string; balance: number };

export type MonthlyResult = { month: string; trades: number; netProfit: number };

export type SessionResult = {
  session: Exclude<Session, "ALL">;
  trades: number;
  wins: number;
  losses: number;
  netProfit: number;
};

export type DirectionResult = {
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  netProfit: number;
};

export type BacktestMetrics = {
  initialBalance: number;
  finalBalance: number;
  netProfit: number; // USD
  netProfitPips: number;
  grossProfit: number;
  grossLoss: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  breakevenTrades: number;
  ambiguousTrades: number;
  skippedTrades: number;
  openAtEndTrades: number;
  winRate: number;
  lossRate: number;
  profitFactor: number | null;
  expectedPayoff: number;
  averageWin: number;
  averageLoss: number;
  largestWin: number;
  largestLoss: number;
  maxDrawdown: number; // USD
  maxDrawdownPercent: number;
  maxConsecutiveWins: number;
  maxConsecutiveLosses: number;
  buy: DirectionResult;
  sell: DirectionResult;
  monthly: MonthlyResult[];
  bySession: SessionResult[];
};

export type RunStatus = "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED";

export type RunSummary = {
  runId: string;
  status: RunStatus;
  createdAt: string;
  finishedAt: string | null;
  error: string | null;
  warnings: string[];
  calculationVersion?: string; // absent on legacy runs
  config: StoredConfig | Record<string, unknown>;
  metrics: BacktestMetrics | null;
};

export function isLegacyRun(r: RunSummary): boolean {
  return r.calculationVersion !== "2.0-pip-based";
}

export type CacheStatus = "NOT_INDEXED" | "INDEXING" | "READY" | "FAILED";

export type CacheMeta = {
  status: CacheStatus;
  timeframe: "H1" | "H4" | "M1" | "D1";
  sourceFile: string;
  fingerprint: { path: string; size: number; mtimeMs: number };
  candleCount: number;
  firstDate: string | null;
  lastDate: string | null;
  duplicateCount: number;
  invalidCount: number;
  outOfOrderCount: number;
  gapCount: number;
  indexedAt: string;
  sourceFileSize: number;
  cacheFileSize: number;
  error?: string;
};

import type { BacktestTrade, Candle, EquityPoint } from "@/backtest/types";

export type XauTrendPullbackH1Config = {
  strategyId: "xau_trend_pullback_h1";
  strategyName: "XAU Trend Pullback H1";
  startDate: string;
  endDate: string;
  lot: number;
  initialBalance: number;
  riskReward: 2;
  emaFastPeriod: 50;
  emaSlowPeriod: 200;
  atrPeriod: 14;
  warmupCandles: 204;
  pullbackAtrTolerance: 0.25;
  trendAtrSeparation: 0.5;
  swingLookback: 10;
  swingFractalRadius: 2;
  swingBufferAtr: 0.1;
  stopAtrMultiple: 1.5;
  confirmationBodyMin: 0.5;
  confirmationCloseTopFraction: 0.75;
  maxTradesPerDay: 2;
  maxLossesPerDay: 2;
};

export type H1IndicatorPoint = {
  ema50: number | null;
  ema200: number | null;
  atr14: number | null;
};

export type H1Signal = {
  index: number;
  direction: "BUY" | "SELL";
  signalTime: string;
  entryIndex: number;
  entryTime: string;
  atr14: number;
  ema50: number;
  ema200: number;
  swingPrice: number | null;
};

export type TrendPullbackH1Result = {
  trades: BacktestTrade[];
  equity: EquityPoint[];
  indicators: H1IndicatorPoint[];
};

export type H1CandleSeries = Candle[];

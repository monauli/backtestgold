export type XauTrendPullbackH1Config = {
  strategyId: "xau_trend_pullback_h1";
  startDate: string;
  endDate: string;
  lot: number;
  initialBalance: number;
  trendMethod?: string;
  pullbackMethod?: string;
  entryMethod?: string;
  stopLossMethod?: string;
  takeProfitMethod?: string;
};

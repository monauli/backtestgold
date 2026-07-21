import type { BacktestTrade } from "@/backtest/types";

export const existingCandleTimezone = "UTC";
const dayKey = (timestamp: number) => new Date(timestamp).toISOString().slice(0, 10);

export type DailyStopStats = {
  blockedDays: Set<string>;
  skippedSignals: number;
};

export function summarizeDailyLosses(trades: BacktestTrade[]) {
  const byDay = new Map<string, number>();
  for (const trade of trades) {
    if (!trade.exitTime || trade.result === "SKIPPED" || trade.result === "AMBIGUOUS") continue;
    const day = trade.exitTime.slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + trade.netProfit);
  }
  const values = Array.from(byDay.values());
  let current = 0;
  let maximum = 0;
  for (const value of Array.from(byDay.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([, value]) => value)) {
    if (value < 0) current++; else current = 0;
    maximum = Math.max(maximum, current);
  }
  return { worstDailyLoss: values.length ? Math.min(...values) : 0, consecutiveLosingDays: maximum };
}

export function createStopAfterOneDailyLoss() {
  const stats: DailyStopStats = { blockedDays: new Set(), skippedSignals: 0 };
  let currentDay: string | null = null;
  let tradingBlocked = false;

  const resetForTimestamp = (timestamp: number) => {
    const day = dayKey(timestamp);
    if (day !== currentDay) {
      currentDay = day;
      tradingBlocked = false;
    }
  };

  return {
    canEnter(timestamp: number) {
      resetForTimestamp(timestamp);
      if (tradingBlocked) {
        stats.skippedSignals++;
        return false;
      }
      return true;
    },
    onTradeClosed(trade: BacktestTrade) {
      if (!(trade.netProfit < 0) || !trade.exitTime) return;
      const timestamp = Date.parse(trade.exitTime);
      resetForTimestamp(timestamp);
      tradingBlocked = true;
      stats.blockedDays.add(currentDay!);
    },
    stats,
    isBlocked(timestamp: number) {
      resetForTimestamp(timestamp);
      return tradingBlocked;
    },
  };
}

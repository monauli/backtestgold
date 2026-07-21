import { describe, expect, it } from "vitest";
import type { BacktestTrade } from "@/backtest/types";
import { createStopAfterOneDailyLoss, summarizeDailyLosses } from "@/strategies/breakout_h4_stop_after_1_loss";

const t = (exitTime: string, netProfit: number): BacktestTrade => ({
  id: "T1", direction: "BUY", referenceH4Time: exitTime, referenceHigh: 1, referenceLow: 1, breakoutLevel: 1,
  entryTime: exitTime, entryPrice: 1, stopLoss: 0, takeProfit: 2, exitTime, exitPrice: 1,
  result: netProfit < 0 ? "LOSS" : netProfit > 0 ? "WIN" : "BREAKEVEN", pips: 0, grossProfit: netProfit,
  commission: 0, netProfit, balanceBefore: 10000, balanceAfter: 10000 + netProfit,
});

describe("Breakout H4 stop after one daily loss", () => {
  it("allows another signal after a profit, then blocks the whole day after the first loss", () => {
    const stop = createStopAfterOneDailyLoss();
    expect(stop.canEnter(Date.parse("2024-01-02T09:00:00Z"))).toBe(true);
    stop.onTradeClosed(t("2024-01-02T10:00:00Z", 140));
    expect(stop.canEnter(Date.parse("2024-01-02T11:00:00Z"))).toBe(true);
    stop.onTradeClosed(t("2024-01-02T12:00:00Z", -70));
    expect(stop.canEnter(Date.parse("2024-01-02T13:00:00Z"))).toBe(false);
    expect(stop.stats.skippedSignals).toBe(1);
  });

  it("resets on the next UTC trading day and does not carry a skipped signal", () => {
    const stop = createStopAfterOneDailyLoss();
    stop.onTradeClosed(t("2024-01-02T23:59:00Z", -70));
    expect(stop.canEnter(Date.parse("2024-01-03T00:00:00Z"))).toBe(true);
    expect(stop.stats.skippedSignals).toBe(0);
  });

  it("does not block on realized PnL equal to zero", () => {
    const stop = createStopAfterOneDailyLoss();
    stop.onTradeClosed(t("2024-01-02T12:00:00Z", 0));
    expect(stop.canEnter(Date.parse("2024-01-02T13:00:00Z"))).toBe(true);
  });

  it("records a position crossing midnight on its exit date", () => {
    const stop = createStopAfterOneDailyLoss();
    stop.onTradeClosed(t("2024-01-03T00:05:00Z", -70));
    expect(stop.stats.blockedDays).toEqual(new Set(["2024-01-03"]));
    expect(stop.isBlocked(Date.parse("2024-01-03T12:00:00Z"))).toBe(true);
    expect(stop.isBlocked(Date.parse("2024-01-04T00:00:00Z"))).toBe(false);
  });

  it("keeps daily loss and losing-day summary based on exit dates", () => {
    const summary = summarizeDailyLosses([
      t("2024-01-02T10:00:00Z", -70),
      t("2024-01-02T12:00:00Z", 140),
      t("2024-01-03T10:00:00Z", -70),
    ]);
    expect(summary.worstDailyLoss).toBe(-70);
    expect(summary.consecutiveLosingDays).toBe(1);
  });
});

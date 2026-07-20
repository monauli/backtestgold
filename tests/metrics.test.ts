import { describe, it, expect } from "vitest";
import { computeMetrics } from "@/backtest/metrics";
import type { BacktestTrade, EquityPoint } from "@/backtest/types";

function trade(over: Partial<BacktestTrade>): BacktestTrade {
  return {
    id: "T1",
    direction: "BUY",
    referenceH4Time: "2024-01-02T00:00:00.000Z",
    referenceHigh: 2000,
    referenceLow: 1990,
    breakoutLevel: 2010,
    entryTime: "2024-01-02T04:05:00.000Z",
    entryPrice: 2010,
    stopLoss: 1990,
    takeProfit: 2050,
    exitTime: "2024-01-02T05:00:00.000Z",
    exitPrice: 2050,
    result: "WIN",
    pips: 400,
    grossProfit: 160,
    commission: 0,
    netProfit: 160,
    balanceBefore: 10000,
    balanceAfter: 10160,
    ...over,
  };
}

describe("metrics", () => {
  const trades = [
    trade({ id: "T1", netProfit: 160, pips: 400 }),
    trade({ id: "T2", netProfit: -80, pips: -200, result: "LOSS", entryTime: "2024-01-02T10:00:00.000Z" }),
    trade({ id: "T3", netProfit: -80, pips: -200, result: "LOSS", entryTime: "2024-02-01T10:00:00.000Z" }),
    trade({ id: "T4", netProfit: 160, pips: 400, direction: "SELL", entryTime: "2024-02-02T16:00:00.000Z" }),
  ];
  const equity: EquityPoint[] = [
    { time: "a", balance: 10000 },
    { time: "b", balance: 10160 },
    { time: "c", balance: 10080 },
    { time: "d", balance: 10000 },
    { time: "e", balance: 10160 },
  ];
  const m = computeMetrics(trades, equity, 10000);

  it("computes win rate from WIN and LOSS trades", () => {
    expect(m.totalTrades).toBe(4);
    expect(m.winningTrades).toBe(2);
    expect(m.losingTrades).toBe(2);
    expect(m.winRate).toBe(50);
    expect(m.lossRate).toBe(50);
  });

  it("net profit equals the sum of all trade P/L", () => {
    const sum = trades.reduce((s, t) => s + t.netProfit, 0);
    expect(m.netProfit).toBe(sum);
    expect(m.netProfit).toBe(160);
    expect(m.netProfitPips).toBe(400);
    expect(m.finalBalance).toBe(10160);
  });

  it("computes profit factor = grossProfit / |grossLoss|", () => {
    expect(m.grossProfit).toBe(320);
    expect(m.grossLoss).toBe(-160);
    expect(m.profitFactor).toBe(2);
  });

  it("computes max drawdown from equity peak to trough", () => {
    expect(m.maxDrawdown).toBe(160); // 10160 -> 10000
    expect(m.maxDrawdownPercent).toBeCloseTo((160 / 10160) * 100, 2);
  });

  it("computes consecutive wins/losses and direction win rates", () => {
    expect(m.maxConsecutiveLosses).toBe(2);
    expect(m.maxConsecutiveWins).toBe(1);
    expect(m.buy.trades).toBe(3);
    expect(m.buy.winRate).toBeCloseTo(33.33, 1);
    expect(m.sell.winRate).toBe(100);
  });

  it("groups net profit per month", () => {
    expect(m.monthly).toEqual([
      { month: "2024-01", trades: 2, netProfit: 80 },
      { month: "2024-02", trades: 2, netProfit: 80 },
    ]);
  });

  it("keeps OPEN_AT_END as a label while counting its signed P/L", () => {
    const open = trade({ id: "OPEN", result: "OPEN_AT_END", netProfit: 40, pips: 100, entryTime: "2024-03-01T10:00:00.000Z" });
    const result = computeMetrics([open], [{ time: "a", balance: 10000 }, { time: "b", balance: 10040 }], 10000);
    expect(open.result).toBe("OPEN_AT_END");
    expect(result.totalTrades).toBe(1);
    expect(result.winningTrades).toBe(1);
    expect(result.losingTrades).toBe(0);
    expect(result.breakevenTrades).toBe(0);
    expect(result.openAtEndTrades).toBe(1);
    expect(result.netProfit).toBe(40);
    expect(result.finalBalance).toBe(10040);
  });

  it("counts a zero-profit OPEN_AT_END as break-even", () => {
    const open = trade({ id: "OPEN_ZERO", result: "OPEN_AT_END", netProfit: 0, pips: 0 });
    const result = computeMetrics([open], [{ time: "a", balance: 10000 }], 10000);
    expect(result.totalTrades).toBe(1);
    expect(result.breakevenTrades).toBe(1);
    expect(result.openAtEndTrades).toBe(1);
    expect(result.winRate).toBe(0);
  });
});

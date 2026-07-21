import { describe, expect, it } from "vitest";
import { DailyPreviousCandleBreakoutEngine } from "@/strategies/daily_previous_candle_breakout";
import { getStrategy } from "@/strategies/registry";
import { pipsToPrice } from "@/backtest/methods";

const d = (value: string) => Date.parse(`${value}T00:00:00.000Z`);
const m1 = (day: string, hour: number, high: number, low: number, open = 3400, close = 3400) => ({ timestamp: d(day) + hour * 3600_000, open, high, low, close });
const daily = (day: string, high: number, low: number) => ({ timestamp: d(day), open: low, high, low, close: high });
const make = (candles: ReturnType<typeof daily>[], params: Partial<{ entryOffset: number; stopLossPips: number; takeProfitPips: number }> = {}) => new DailyPreviousCandleBreakoutEngine(candles, { breakoutDistance: 0, stopLossDistance: pipsToPrice(params.stopLossPips ?? 200), takeProfitDistance: pipsToPrice(params.takeProfitPips ?? 400), lot: 0.35, initialBalance: 10000, spread: 0, slippage: 0, commission: 0, session: "ALL", ambiguousHandling: "SKIP", entryOffset: params.entryOffset ?? 10 });

describe("Daily Previous Candle Breakout", () => {
  it("registers the D1 signal and M1 execution strategy", () => {
    expect(getStrategy("daily_previous_candle_breakout")).toMatchObject({ name: "Daily Previous Candle Breakout", signalTimeframe: "D1", executionTimeframe: "M1" });
  });

  it("calculates Buy Stop and Sell Stop from the previous closed D1 candle using absolute price offset", () => {
    const e = make([daily("2023-12-29", 3500, 3000), daily("2024-01-01", 3600, 3200)]);
    e.onM1(m1("2024-01-01", 0, 3400, 3400));
    expect(e.buyStop).toBe(3510); expect(e.sellStop).toBe(2990); expect(e.previousDailyHigh).toBe(3500); expect(e.previousDailyLow).toBe(3000);
  });

  it("uses only closed D1 candles and never the running/current D1 candle", () => {
    const e = make([daily("2024-01-01", 5000, 1000)]);
    e.onM1(m1("2024-01-01", 0, 5100, 900));
    expect(e.buyStop).toBeNull(); expect(e.sellStop).toBeNull(); expect(e.trades).toHaveLength(0);
  });

  it("BUY trigger consumes and cancels the SELL pending level", () => {
    const e = make([daily("2023-12-29", 3500, 3000), daily("2024-01-01", 3600, 3200)]);
    e.onM1(m1("2024-01-01", 1, 3510, 3505)); e.onM1(m1("2024-01-01", 2, 3515, 3489));
    expect(e.trades[0].direction).toBe("BUY"); expect(e.sellStop).toBe(2990); e.onM1(m1("2024-01-01", 2, 3508, 3506)); expect(e.trades).toHaveLength(1);
  });

  it("SELL trigger consumes and cancels the BUY pending level", () => {
    const e = make([daily("2023-12-29", 3500, 3000), daily("2024-01-01", 3600, 3200)]);
    e.onM1(m1("2024-01-01", 1, 3005, 2990)); e.onM1(m1("2024-01-01", 2, 3010, 3010));
    expect(e.trades[0].direction).toBe("SELL"); e.onM1(m1("2024-01-01", 2, 3008, 2995)); expect(e.trades).toHaveLength(1);
  });

  it("allows at most one entry per day and expires an untriggered signal at UTC midnight", () => {
    const e = make([daily("2023-12-29", 3500, 3000), daily("2024-01-01", 3600, 3200), daily("2024-01-02", 3700, 3300)]);
    e.onM1(m1("2024-01-01", 23, 3450, 3050)); e.onM1(m1("2024-01-02", 0, 3510, 3500));
    expect(e.trades).toHaveLength(0); expect(e.pendingExpiredDays).toBe(1); expect(e.noTriggerDays).toBe(1); expect(e.buyStop).toBe(3610); expect(e.sellStop).toBe(3190);
  });

  it("does not carry an expired signal into the next day", () => {
    const e = make([daily("2023-12-29", 3500, 3000), daily("2024-01-01", 3600, 3200), daily("2024-01-02", 3700, 3300)]);
    e.onM1(m1("2024-01-01", 23, 3509, 2991)); e.onM1(m1("2024-01-02", 1, 3510, 3195));
    expect(e.trades).toHaveLength(0);
  });

  it("keeps an open position across midnight and does not create new pending orders", () => {
    const e = make([daily("2023-12-29", 3500, 3000), daily("2024-01-01", 3600, 3200), daily("2024-01-02", 3700, 3300)]);
    e.onM1(m1("2024-01-01", 1, 3510, 3505)); e.onM1(m1("2024-01-02", 0, 3515, 3500));
    expect(e.trades).toHaveLength(0); e.onM1(m1("2024-01-02", 1, 3505, 3489)); expect(e.trades).toHaveLength(1); expect(e.trades[0].result).toBe("LOSS");
  });

  it("resolves Buy/Sell ambiguity conservatively by skipping the event", () => {
    const e = make([daily("2023-12-29", 3500, 3000), daily("2024-01-01", 3600, 3200)]);
    e.onM1(m1("2024-01-01", 1, 3510, 2990));
    expect(e.ambiguousSignals).toBe(1); expect(e.skippedSignals).toBe(1); expect(e.trades).toHaveLength(0);
  });

  it("resolves same-candle SL/TP using the existing conservative SL policy", () => {
    const e = make([daily("2023-12-29", 3500, 3000), daily("2024-01-01", 3600, 3200)]);
    e.onM1(m1("2024-01-01", 1, 3550, 3490));
    expect(e.trades[0].direction).toBe("BUY"); expect(e.trades[0].result).toBe("LOSS"); expect(e.trades[0].exitPrice).toBe(3490); expect(e.trades[0].netProfit).toBe(-70);
  });

  it("uses existing pip conversion and PnL formula", () => {
    const e = make([daily("2023-12-29", 3500, 3000), daily("2024-01-01", 3600, 3200)], { entryOffset: 10, stopLossPips: 200, takeProfitPips: 400 });
    e.onM1(m1("2024-01-01", 1, 3510, 3505)); e.onM1(m1("2024-01-01", 2, 3550, 3515));
    expect(e.trades[0].entryPrice).toBe(3510); expect(e.trades[0].takeProfit).toBe(3550); expect(e.trades[0].netProfit).toBe(140); expect(e.balance).toBe(10140);
  });
});

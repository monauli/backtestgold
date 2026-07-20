import { describe, expect, it } from "vitest";
import { BreakoutEngine } from "@/backtest/engine";
import { calculateRiskReward, validatePeriod } from "@/backtest/report";
import { pipsToPrice } from "@/backtest/methods";
import { c, T0, H4, M1 } from "./helpers";

describe("flexible breakout configuration", () => {
  it("calculates pip distances and RR", () => {
    expect(pipsToPrice(100)).toBe(10); expect(pipsToPrice(200)).toBe(20); expect(pipsToPrice(400)).toBe(40); expect(calculateRiskReward(400, 200)).toBe(2);
  });
  it("uses custom breakout, SL and TP distances in the engine", () => {
    const h4 = [c(T0, 2000, 2050, 1950, 2000), c(T0 + H4, 2000, 2001, 1999, 2000)];
    const engine = new BreakoutEngine(h4, { breakoutDistance: 5, stopLossDistance: 7, takeProfitDistance: 12, lot: 0.4, initialBalance: 10000, spread: 0, slippage: 0, commission: 0, session: "ALL", ambiguousHandling: "SKIP" });
    engine.onM1(c(T0 + H4, 2000, 2055, 2000, 2050)); engine.onM1(c(T0 + H4 + M1, 2050, 2068, 2049, 2065));
    expect(engine.trades[0].entryPrice).toBe(2055); expect(engine.trades[0].stopLoss).toBe(2048); expect(engine.trades[0].takeProfit).toBe(2067);
  });
  it("validates periods and includes the full end date", () => {
    const result = validatePeriod("2024-01-02", "2024-01-03", Date.UTC(2024, 0, 1), Date.UTC(2024, 0, 5, 23, 59, 59, 999));
    expect(new Date(result.toMs).toISOString()).toBe("2024-01-03T23:59:59.999Z");
    expect(() => validatePeriod("2024-01-04", "2024-01-03", Date.UTC(2024, 0, 1), Date.UTC(2024, 0, 5))).toThrow();
    expect(() => validatePeriod("2023-12-01", "2024-01-03", Date.UTC(2024, 0, 1), Date.UTC(2024, 0, 5))).toThrow();
  });
});

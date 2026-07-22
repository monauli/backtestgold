import { describe, expect, it } from "vitest";
import { aggregateSimulations, simulateWindow, type SimulationResult } from "@/lib/prop-firm-simulator";
import { PROP_FIRM_PROGRAMS } from "@/config/prop-firm-programs";
import type { BacktestTrade } from "@/backtest/types";
import { normalizeHistoryRecord, normalizeNumericFields, recommendationForHistory, safeFixed } from "@/lib/prop-firm-simulator/format";
const p = PROP_FIRM_PROGRAMS[0];
function t(date: string, pnl: number): BacktestTrade { return { id: date, direction: "BUY", referenceH4Time: date, referenceHigh: 0, referenceLow: 0, breakoutLevel: 0, entryTime: `${date}T12:00:00Z`, entryPrice: 1, stopLoss: 0, takeProfit: 2, exitTime: `${date}T12:00:00Z`, exitPrice: 1, result: pnl > 0 ? "WIN" : "LOSS", pips: pnl, grossProfit: pnl, commission: 0, netProfit: pnl, balanceBefore: 10000, balanceAfter: 10000 + pnl } as BacktestTrade; }
function result(x: Partial<SimulationResult>): SimulationResult { return { startDate: "2024-01-01", step1: "FAIL", step2: "FAIL", step1Days: null, step2Days: null, profitableDays: 0, finalBalance: 10000, netProfit: 0, worstDailyLoss: 0, maximumTotalDrawdown: 0, dailyLossBreach: false, maximumLossBreach: false, overall: "FAIL", ...x }; }
describe("Prop Firm Simulator", () => {
  it("formats legacy partial history safely", () => { expect(safeFixed(undefined)).toBe("-"); expect(safeFixed(null)).toBe("-"); expect(safeFixed(Number.NaN)).toBe("-"); expect(normalizeNumericFields({ fullChallengePassRate: undefined, worstDailyLoss: -300.00000000000006 }, ["fullChallengePassRate", "worstDailyLoss"])).toEqual({ fullChallengePassRate: null, worstDailyLoss: -300.00000000000006 }); });
  it("maps legacy drawdown and calculates the expected lot recommendations", () => {
    const base = { fullChallengePassRate: 96, worstDailyLoss: -300.00000000000006, dailyLossBreaches: 0, maximumLossBreaches: 0 };
    expect(normalizeHistoryRecord({ ...base, maximumTotalDrawdown: 700.0000000000001 }).maximumDrawdown).toBe(700);
    expect(recommendationForHistory({ ...base, maximumTotalDrawdown: 700.0000000000001 }).recommendationStatus).toBe("LAYAK");
    expect(recommendationForHistory({ ...base, maximumTotalDrawdown: 700.02 }).recommendationStatus).toBe("DITOLAK");
    expect(recommendationForHistory({ ...base, maximumTotalDrawdown: 701 }).recommendationStatus).toBe("DITOLAK");
  });
  it("aggregates negative daily loss and absolute drawdown correctly", () => { const s = aggregateSimulations([result({ worstDailyLoss: -140, maximumTotalDrawdown: 140 }), result({ worstDailyLoss: -280, maximumTotalDrawdown: 280 }), result({ worstDailyLoss: -70, maximumTotalDrawdown: 70 })]); expect(s.worstDailyLoss).toBe(-280); expect(s.maximumTotalDrawdown).toBe(280); });
  it("resets Step 2 balance and counts only $50 profitable days", () => { const out = simulateWindow([t("2024-01-01", 800), t("2024-01-02", 49), t("2024-01-03", 50), t("2024-01-04", 50), t("2024-01-05", 50), t("2024-01-06", 350)], p, "2024-01-01"); expect(out.step1).toBe("PASS"); expect(out.step2).toBe("PASS"); expect(out.step1Days).toBe(1); expect(out.step2Days).toBe(5); });
  it("aggregates daily and maximum loss breaches", () => { const s = aggregateSimulations([result({ dailyLossBreach: true, maximumLossBreach: true }), result({ dailyLossBreach: false, maximumLossBreach: false })]); expect(s.dailyLossBreaches).toBe(1); expect(s.maximumLossBreaches).toBe(1); });
  it("uses Europe/Helsinki day boundaries", () => { const out = simulateWindow([t("2024-01-01", 49), t("2024-01-01", 1)], p, "2024-01-01"); expect(out.profitableDays).toBe(1); });
  it("supports Step 1 PASS followed by Step 2 FAIL", () => { const out = simulateWindow([t("2024-01-01", 800), t("2024-01-02", 100)], p, "2024-01-01"); expect(out.step1).toBe("PASS"); expect(out.step2).toBe("FAIL"); });
});

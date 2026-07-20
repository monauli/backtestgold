import { describe, expect, it } from "vitest";
import { equityUpsertOperations, equityUpsertOperations as equityOps, tradeUpsertOperations, validateEquity, validateTrades } from "@/lib/cloud-backtest-worker";
import type { BacktestTrade } from "@/backtest/types";

const trade = (id: string, entryTime: string, result: "WIN" | "LOSS", netProfit: number): BacktestTrade => ({
  id, direction: "BUY", referenceH4Time: entryTime, referenceHigh: 2050, referenceLow: 2040, breakoutLevel: 2050,
  entryTime, entryPrice: 2050, stopLoss: 2040, takeProfit: 2070, exitTime: entryTime, exitPrice: 2055,
  result, pips: 50, grossProfit: netProfit, commission: 0, netProfit, balanceBefore: 10000, balanceAfter: 10000 + netProfit,
});

describe("cloud worker persistence contracts", () => {
  it("assigns ordered, numeric, unique trade sequences server-side", () => {
    const { documents } = validateTrades("backtest001XAU", [trade("T2", "2024-01-02T00:00:00Z", "LOSS", -10), trade("T1", "2024-01-01T00:00:00Z", "WIN", 20)]);
    expect(documents.map((x) => x.tradeSequence)).toEqual([1, 2]);
    expect(documents.every((x) => Number.isInteger(x.tradeSequence) && x.tradeSequence > 0)).toBe(true);
    expect(tradeUpsertOperations(documents).every((x) => x.updateOne.upsert === true)).toBe(true);
    expect(tradeUpsertOperations(documents).map((x) => x.updateOne.filter)).toEqual([{ runId: "backtest001XAU", tradeSequence: 1 }, { runId: "backtest001XAU", tradeSequence: 2 }]);
  });

  it("keeps the same sequence space independent per run", () => {
    const first = validateTrades("run-a", [trade("T1", "2024-01-01T00:00:00Z", "WIN", 1)]).documents[0];
    const second = validateTrades("run-b", [trade("T1", "2024-01-01T00:00:00Z", "WIN", 1)]).documents[0];
    expect(first.tradeSequence).toBe(1); expect(second.tradeSequence).toBe(1); expect(first.runId).not.toBe(second.runId);
  });

  it("uses numeric equity sequences starting at zero and upsert", () => {
    const documents = validateEquity("backtest001XAU", [{ time: "2024-01-01T00:00:00Z", balance: 10000 }, { time: "2024-01-02T00:00:00Z", balance: 10010 }]);
    expect(documents.map((x) => x.sequence)).toEqual([0, 1]);
    expect(equityOps(documents).every((x) => x.updateOne.upsert === true)).toBe(true);
    expect(equityUpsertOperations(documents)[1].updateOne.filter).toEqual({ runId: "backtest001XAU", sequence: 1 });
  });
});

import { describe, expect, it } from "vitest";
import { buildBatchGrid, parseGridValues, qualificationReason, scoreBatchResults } from "@/lib/batch-grid";

describe("batch grid search", () => {
  it("creates deterministic 5 x 3 x 3 combinations", () => { const grid = buildBatchGrid({ breakoutPips: [5, 10, 15, 20, 25], stopLossPips: [150, 200, 250], takeProfitPips: [300, 400, 500] }); expect(grid).toHaveLength(45); expect(grid[0]).toMatchObject({ combinationId: "batch001XAU-C001", breakoutPips: 5, stopLossPips: 150, takeProfitPips: 300 }); expect(grid[1].takeProfitPips).toBe(400); expect(new Set(grid.map((x) => x.combinationId)).size).toBe(45); });
  it("rejects duplicate values and more than 100 combinations", () => { expect(() => parseGridValues("5,5")).toThrow("GRID_VALUES_DUPLICATE"); expect(() => buildBatchGrid({ breakoutPips: Array.from({ length: 101 }, (_, i) => i + 1), stopLossPips: [1], takeProfitPips: [1] })).toThrow("BATCH_MAX_COMBINATIONS_EXCEEDED"); });
  it("scores and qualifies within the same batch", () => { const ranked = scoreBatchResults([{ combinationId: "a", profitFactor: 2, netProfit: 500, maximumDrawdownPercent: 5, winRate: 60, totalTrades: 400 }, { combinationId: "b", profitFactor: 1, netProfit: 100, maximumDrawdownPercent: 20, winRate: 80, totalTrades: 100 }]); expect(String(ranked[0].combinationId)).toBe("a"); expect(qualificationReason(ranked[0])).toEqual([]); expect(qualificationReason(ranked[1]).length).toBeGreaterThan(0); });
});

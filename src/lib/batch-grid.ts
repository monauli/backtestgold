export type BatchCombination = { combinationId: string; breakoutPips: number; stopLossPips: number; takeProfitPips: number };
export type BatchScoreRow = Record<string, number | string | null>;
export type BatchGridInput = { breakoutPips: number[]; stopLossPips: number[]; takeProfitPips: number[] };
export function parseGridValues(value: string): number[] {
  const values = value.split(",").map((x) => Number(x.trim()));
  if (!values.length || values.some((x) => !Number.isFinite(x) || x <= 0)) throw new Error("GRID_VALUES_MUST_BE_POSITIVE");
  if (new Set(values).size !== values.length) throw new Error("GRID_VALUES_DUPLICATE");
  return [...values].sort((a, b) => a - b);
}
export function buildBatchGrid(input: BatchGridInput, batchId = "batch001XAU") {
  const result: BatchCombination[] = [];
  for (const breakoutPips of [...input.breakoutPips].sort((a, b) => a - b)) for (const stopLossPips of [...input.stopLossPips].sort((a, b) => a - b)) for (const takeProfitPips of [...input.takeProfitPips].sort((a, b) => a - b)) result.push({ combinationId: `${batchId}-C${String(result.length + 1).padStart(3, "0")}`, breakoutPips, stopLossPips, takeProfitPips });
  if (result.length > 100) throw new Error("BATCH_MAX_COMBINATIONS_EXCEEDED");
  return result;
}
export function scoreBatchResults(results: BatchScoreRow[]): Array<BatchScoreRow & { overallScore: number }> {
  const range = (key: string) => { const xs = results.map((x) => Number(x[key] ?? 0)); return { min: Math.min(...xs), max: Math.max(...xs) }; };
  const pf = range("profitFactor"); const net = range("netProfit"); const dd = range("maximumDrawdownPercent"); const wr = range("winRate"); const sample = range("totalTrades");
  const norm = (value: number, r: { min: number; max: number }) => r.max === r.min ? 1 : (value - r.min) / (r.max - r.min);
  return results.map((x) => ({ ...x, overallScore: 100 * (norm(Number(x.profitFactor ?? 0), pf) * .35 + norm(Number(x.netProfit ?? 0), net) * .25 + (1 - norm(Number(x.maximumDrawdownPercent ?? 0), dd)) * .20 + norm(Number(x.winRate ?? 0), wr) * .10 + norm(Number(x.totalTrades ?? 0), sample) * .10) })).sort((a, b) => Number(b.overallScore) - Number(a.overallScore));
}
export function qualificationReason(row: BatchScoreRow) { const reasons: string[] = []; if (Number(row.totalTrades) < 300) reasons.push("Sampel trade terlalu sedikit"); if (Number(row.profitFactor) < 1.3) reasons.push("Profit factor di bawah 1.30"); if (Number(row.maximumDrawdownPercent) > 10) reasons.push("Drawdown melebihi 10%"); if (Number(row.netProfit) <= 0) reasons.push("Net profit negatif"); return reasons; }

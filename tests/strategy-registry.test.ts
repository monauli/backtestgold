import { describe, expect, it } from "vitest";
import { strategyRegistry, getStrategy } from "@/strategies/registry";
import { validateXauTrendPullbackH1Config } from "@/strategies/xau_trend_pullback_h1";
import { XAU_TREND_PULLBACK_H1_REPORT_DIR, XAU_TREND_PULLBACK_H1_REPORT_PREFIX } from "@/strategies/xau_trend_pullback_h1/report";
import { findDataFile } from "@/data/validator";
import { readTemplates } from "@/backtest/templates";

describe("strategy isolation", () => {
  it("registers a unique H1 strategy as DRAFT", () => {
    const h1 = getStrategy("xau_trend_pullback_h1");
    expect(h1?.id).toBe("xau_trend_pullback_h1"); expect(h1?.status).toBe("DRAFT");
    expect(new Set(strategyRegistry.map((s) => s.id)).size).toBe(strategyRegistry.length);
  });
  it("does not validate the H1 strategy as executable", () => {
    const result = validateXauTrendPullbackH1Config({ strategyId: "xau_trend_pullback_h1", lot: 0.4, initialBalance: 10000 });
    expect(result.valid).toBe(false); expect(result.errors.join(" ")).toContain("Trend definition");
  });
  it("keeps H1 source and report namespace separate", () => {
    expect(findDataFile("H1")).toMatch(/XAUUSD_H1_2010_2026\.csv$/i);
    expect(findDataFile("H1")).not.toMatch(/H12/i);
    expect(XAU_TREND_PULLBACK_H1_REPORT_DIR).toContain("reports\\xau_trend_pullback_h1");
    expect(`${XAU_TREND_PULLBACK_H1_REPORT_PREFIX}backtest001XAU_summary.json`).toMatch(/^xau_trend_pullback_h1_/);
  });
  it("does not expose Breakout templates to H1", () => {
    expect(readTemplates("xau_trend_pullback_h1")).toEqual([]);
    expect(readTemplates("xau_h4_breakout").every((t) => t.strategyId === "xau_h4_breakout")).toBe(true);
  });
});

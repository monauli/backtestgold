import { describe, expect, it } from "vitest";
import { strategyRegistry, getStrategy } from "@/strategies/registry";
import { validateXauTrendPullbackH1Config } from "@/strategies/xau_trend_pullback_h1";
import { XAU_TREND_PULLBACK_H1_REPORT_DIR, XAU_TREND_PULLBACK_H1_REPORT_PREFIX } from "@/strategies/xau_trend_pullback_h1/report";
import { findDataFile } from "@/data/validator";
import { readTemplates } from "@/backtest/templates";

describe("strategy isolation", () => {
  it("registers the EMA trend Breakout variant separately from baseline", () => {
    const variant = getStrategy("breakout_h4_ema_trend");
    expect(variant?.name).toBe("Breakout H4 + EMA Trend Filter"); expect(variant?.status).toBe("READY"); expect(variant?.signalTimeframe).toBe("H4"); expect(variant?.executionTimeframe).toBe("M1"); expect(variant?.id).not.toBe("xau_h4_breakout");
  });
  it("registers the daily-stop Breakout variant separately from baseline", () => {
    const variant = getStrategy("breakout_h4_stop_after_1_loss");
    expect(variant?.name).toBe("Breakout H4 – Stop After 1 Daily Loss"); expect(variant?.status).toBe("READY"); expect(variant?.signalTimeframe).toBe("H4"); expect(variant?.executionTimeframe).toBe("M1"); expect(variant?.id).not.toBe("xau_h4_breakout");
  });
  it("registers a unique H1 strategy with H1 execution", () => {
    const h1 = getStrategy("xau_trend_pullback_h1");
    expect(h1?.id).toBe("xau_trend_pullback_h1"); expect(h1?.status).toBe("READY"); expect(h1?.executionTimeframe).toBe("H1");
    expect(new Set(strategyRegistry.map((s) => s.id)).size).toBe(strategyRegistry.length);
  });
  it("validates the canonical H1 strategy config", () => {
    const result = validateXauTrendPullbackH1Config({ strategyId: "xau_trend_pullback_h1", strategyName: "XAU Trend Pullback H1", lot: 0.35, initialBalance: 10000, riskReward: 2 });
    expect(result.valid).toBe(true); expect(result.errors).toEqual([]);
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

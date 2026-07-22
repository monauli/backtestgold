import { describe, expect, it } from "vitest";
import { BreakoutEngine } from "@/backtest/engine";
import type { Candle, EngineParams } from "@/backtest/types";

const h4: Candle[] = [{ timestamp: 0, open: 100, high: 100, low: 100, close: 100 }, { timestamp: 1, open: 100, high: 100, low: 100, close: 100 }];
const cfg = (directionStop: number): EngineParams => ({ breakoutDistance: 1, stopLossDistance: 20, takeProfitDistance: 40, lot: .3, initialBalance: 10000, spread: 0, slippage: 0, commission: 0, session: "ALL", ambiguousHandling: "SKIP", tradeManagement: { triggerDistance: 2, movedStopDistance: directionStop } });
function run(candles: Candle[], stop = 1) { const e = new BreakoutEngine(h4, cfg(stop)); candles.forEach((c) => e.onM1(c)); return e; }
describe("V3 trade management", () => {
  it("triggers exactly +$60 (+$2) but not +$59.99", () => { expect(run([{ timestamp: 1, open: 100, high: 102.999, low: 101, close: 102 }]).managementStats.movedSlExit).toBe(0); expect(run([{ timestamp: 1, open: 100, high: 103, low: 102.1, close: 102 }]).managementStats.movedSlExit).toBe(0); });
  it("uses V3A/B/C moved stops and conservative same-candle exit", () => { for (const stop of [2 / 3, 1, 5 / 3]) { const e = run([{ timestamp: 1, open: 100, high: 103, low: 101 + stop, close: 102 }], stop); expect(e.managementStats.movedSlExit).toBe(1); expect(e.managementStats.intrabarAmbiguities).toBe(1); } });
  it("prioritizes original SL and supports TP after moved SL", () => { const stopped = run([{ timestamp: 1, open: 100, high: 101, low: 100, close: 101 }, { timestamp: 2, open: 101, high: 103, low: 81, close: 90 }]); expect(stopped.managementStats.originalSl).toBe(1); const tp = run([{ timestamp: 1, open: 100, high: 103, low: 102.1, close: 102 }, { timestamp: 2, open: 102, high: 141, low: 102.1, close: 140 }]); expect(tp.managementStats.fullTp).toBe(1); });
});

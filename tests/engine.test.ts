import { describe, it, expect } from "vitest";
import { c, makeH4, run, T0, H4, M1 } from "./helpers";

// Fixture levels: buy = 2010 (ref high 2000 + 10.00), sell = 1980 (ref low
// 1990 - 10.00). RULE_A: SL 20.00, TP 40.00 →
//   BUY:  SL 1990, TP 2050;  SELL: SL 2000, TP 1940.  Lot 0.4.
const m1t = (i: number) => T0 + H4 + i * M1;

describe("H4 breakout engine (RULE_A)", () => {
  it("opens BUY at previous H4 high + 10.00 on M1 wick touch", () => {
    const e = run(makeH4(), [
      c(m1t(0), 2000, 2005, 1999, 2004),
      c(m1t(1), 2004, 2010.5, 2003, 2006), // wick touches 2010
    ]);
    expect(e.trades).toHaveLength(1);
    const t = e.trades[0];
    expect(t.direction).toBe("BUY");
    expect(t.entryPrice).toBe(2010);
    expect(t.stopLoss).toBe(1990);
    expect(t.takeProfit).toBe(2050);
  });

  it("opens SELL at previous H4 low - 10.00 on M1 wick touch", () => {
    const e = run(makeH4(), [c(m1t(0), 1990, 1991, 1979.5, 1985)]);
    const t = e.trades[0];
    expect(t.direction).toBe("SELL");
    expect(t.entryPrice).toBe(1980);
    expect(t.stopLoss).toBe(2000);
    expect(t.takeProfit).toBe(1940);
  });

  it("does not trigger without a wick touch", () => {
    const e = run(makeH4(), [c(m1t(0), 2000, 2009.99, 1980.01, 2009)]);
    expect(e.trades).toHaveLength(0);
  });

  it("skips when buy and sell levels touch in the same M1 candle", () => {
    const e = run(makeH4(), [c(m1t(0), 1995, 2011, 1979, 2000)]);
    expect(e.ambiguousSignals).toBe(1);
    expect(e.skippedSignals).toBe(1);
    expect(e.trades).toHaveLength(1);
    expect(e.trades[0].result).toBe("SKIPPED");
    expect(e.trades[0].netProfit).toBe(0);
  });

  it("closes at SL: BUY loss = -$80 at lot 0.4 (200 pip)", () => {
    const e = run(makeH4(), [
      c(m1t(0), 2005, 2010, 2004, 2009), // entry BUY @2010
      c(m1t(1), 2009, 2009.5, 1989, 1995), // low <= SL 1990
    ]);
    const t = e.trades[0];
    expect(t.result).toBe("LOSS");
    expect(t.exitPrice).toBe(1990);
    expect(t.pips).toBe(-200);
    expect(t.netProfit).toBe(-80);
  });

  it("closes at TP: BUY win = +$160 at lot 0.4 (400 pip)", () => {
    const e = run(makeH4(), [
      c(m1t(0), 2005, 2010, 2004, 2009),
      c(m1t(1), 2009, 2050.5, 2008, 2040), // high >= TP 2050
    ]);
    const t = e.trades[0];
    expect(t.result).toBe("WIN");
    expect(t.exitPrice).toBe(2050);
    expect(t.pips).toBe(400);
    expect(t.netProfit).toBe(160);
  });

  it("resolves SL and TP in the same M1 candle as LOSS (documented conservative default)", () => {
    const e = run(makeH4(), [
      c(m1t(0), 2005, 2010, 2004, 2009),
      c(m1t(1), 2009, 2051, 1989, 2010), // both SL and TP inside range
    ]);
    expect(e.trades[0].result).toBe("LOSS");
    expect(e.trades[0].exitPrice).toBe(1990);
  });

  it("keeps max one active position", () => {
    const e = run(makeH4(), [
      c(m1t(0), 2005, 2010.5, 2004, 2009), // BUY entry, stays open
      // next period: its buy level (1999 + 10 = 2009) is touched, but the
      // open BUY position must block a second entry
      c(T0 + 2 * H4, 2008, 2009.5, 2005, 2006),
    ]);
    expect(e.trades).toHaveLength(1);
  });

  it("closes an open position at end of data as OPEN_AT_END using last close", () => {
    const e = run(makeH4(), [
      c(m1t(0), 2005, 2010, 2004, 2009),
      c(m1t(1), 2009, 2012, 2008, 2011.5),
    ]);
    const t = e.trades[0];
    expect(t.result).toBe("OPEN_AT_END");
    expect(t.exitPrice).toBe(2011.5);
    expect(t.pips).toBe(15);
    expect(t.netProfit).toBe(6); // 15 pip * 0.4 lot
  });
});

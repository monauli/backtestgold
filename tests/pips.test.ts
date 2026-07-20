import { describe, it, expect } from "vitest";
import { PIP_SIZE, pipsToPrice, priceToPips } from "@/backtest/methods";
import {
  stopLossPrice,
  takeProfitPrice,
  grossProfit,
  pipsToUSD,
} from "@/backtest/execution";

describe("pip definition (1 pip = 0.10 price)", () => {
  it("1 pip = 0.10 price", () => {
    expect(PIP_SIZE).toBe(0.1);
    expect(pipsToPrice(1)).toBeCloseTo(0.1, 10);
  });
  it("100 pip = 10.00 price", () => expect(pipsToPrice(100)).toBeCloseTo(10, 10));
  it("200 pip = 20.00 price", () => expect(pipsToPrice(200)).toBeCloseTo(20, 10));
  it("400 pip = 40.00 price", () => expect(pipsToPrice(400)).toBeCloseTo(40, 10));
  it("price -> pip roundtrip", () => expect(priceToPips(20)).toBeCloseTo(200, 10));
});

describe("SL/TP prices for RULE_A (SL 20.00, TP 40.00 from entry)", () => {
  it("BUY entry 2044.20 -> SL 2024.20", () => {
    expect(stopLossPrice(2044.2, "BUY", 20)).toBeCloseTo(2024.2, 10);
  });
  it("BUY entry 2044.20 -> TP 2084.20", () => {
    expect(takeProfitPrice(2044.2, "BUY", 40)).toBeCloseTo(2084.2, 10);
  });
  it("SELL entry 2044.20 -> SL 2064.20", () => {
    expect(stopLossPrice(2044.2, "SELL", 20)).toBeCloseTo(2064.2, 10);
  });
  it("SELL entry 2044.20 -> TP 2004.20", () => {
    expect(takeProfitPrice(2044.2, "SELL", 40)).toBeCloseTo(2004.2, 10);
  });
});

describe("dollar conversion (1 pip per 1 lot = USD 1)", () => {
  it("lot 0.4, loss 200 pip = -USD 80", () => {
    expect(pipsToUSD(-200, 0.4)).toBeCloseTo(-80, 8);
    // via prices: SELL entry 2044.20, SL exit 2064.20
    expect(grossProfit("SELL", 2044.2, 2064.2, 0.4)).toBeCloseTo(-80, 8);
  });
  it("lot 0.4, profit 400 pip = +USD 160", () => {
    expect(pipsToUSD(400, 0.4)).toBeCloseTo(160, 8);
    expect(grossProfit("SELL", 2044.2, 2004.2, 0.4)).toBeCloseTo(160, 8);
  });
  it("lot 0.1, loss 200 pip = -USD 20", () => {
    expect(pipsToUSD(-200, 0.1)).toBeCloseTo(-20, 8);
    expect(grossProfit("BUY", 2044.2, 2024.2, 0.1)).toBeCloseTo(-20, 8);
  });
  it("lot 0.1, profit 400 pip = +USD 40", () => {
    expect(pipsToUSD(400, 0.1)).toBeCloseTo(40, 8);
    expect(grossProfit("BUY", 2044.2, 2084.2, 0.1)).toBeCloseTo(40, 8);
  });
});

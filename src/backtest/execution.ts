import { PIP_SIZE, PIP_VALUE_PER_LOT_USD } from "./methods";

/**
 * Profit model (pip-based, calculationVersion 2.0-pip-based):
 *   1 pip = 0.10 price; 1 pip per 1.0 lot = USD 1.
 *
 *   priceMovement = BUY ? exit - entry : entry - exit   (signed, price units)
 *   pips          = priceMovement / 0.10                (signed)
 *   grossProfit   = pips * lot * 1 USD
 *   netProfit     = grossProfit - commission
 *
 * Example, lot 0.4: SL 200 pip -> -$80, TP 400 pip -> +$160.
 *
 * Spread/slippage convention: data prices are treated as BID.
 * BUY entries execute at level + spread + slippage (ask side, adverse slip);
 * SELL entries execute at level - slippage. Exits execute at the SL/TP price.
 */
export function entryPrice(
  level: number,
  direction: "BUY" | "SELL",
  cfg: { spread: number; slippage: number }
): number {
  return direction === "BUY"
    ? level + cfg.spread + cfg.slippage
    : level - cfg.slippage;
}

export function stopLossPrice(
  entry: number,
  direction: "BUY" | "SELL",
  stopLossDistance: number
): number {
  return direction === "BUY" ? entry - stopLossDistance : entry + stopLossDistance;
}

export function takeProfitPrice(
  entry: number,
  direction: "BUY" | "SELL",
  takeProfitDistance: number
): number {
  return direction === "BUY" ? entry + takeProfitDistance : entry - takeProfitDistance;
}

/** Signed pip movement of a closed trade. */
export function tradePips(
  direction: "BUY" | "SELL",
  entry: number,
  exit: number
): number {
  const priceMovement = direction === "BUY" ? exit - entry : entry - exit;
  return priceMovement / PIP_SIZE;
}

/** Gross USD profit from a signed pip movement. */
export function pipsToUSD(pips: number, lot: number): number {
  return pips * lot * PIP_VALUE_PER_LOT_USD;
}

export function grossProfit(
  direction: "BUY" | "SELL",
  entry: number,
  exit: number,
  lot: number
): number {
  return pipsToUSD(tradePips(direction, entry, exit), lot);
}

export function netProfit(gross: number, commission: number): number {
  return gross - commission;
}

export const round2 = (n: number) => Math.round(n * 100) / 100;

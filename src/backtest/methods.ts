/**
 * XAUUSD pip definition (fixed, app-wide):
 *   1 pip  = 0.10 price
 *   1 pip per 1.0 lot = USD 1
 */
export const PIP_SIZE = 0.1;
export const PIP_VALUE_PER_LOT_USD = 1;
export const CALCULATION_VERSION = "2.0-pip-based";
export const BREAKOUT_METHOD_NAME = "Breakout H4";

export const pipsToPrice = (pips: number) => pips * PIP_SIZE;
export const priceToPips = (price: number) => price / PIP_SIZE;

export type BacktestMethod = {
  id: string;
  name: string;
  description: string;
  signalTimeframe: "H4";
  executionTimeframe: "M1";
  breakoutPips: number;
  stopLossPips: number;
  takeProfitPips: number;
  riskReward: number;
};

export const METHODS: BacktestMethod[] = [
  {
    id: "RULE_A",
    name: "Aturan A",
    description: "Breakout H4 100 pip, SL 200 pip, TP 400 pip, RR 1:2",
    signalTimeframe: "H4",
    executionTimeframe: "M1",
    breakoutPips: 100,
    stopLossPips: 200,
    takeProfitPips: 400,
    riskReward: 2,
  },
];

export function getMethod(id: string): BacktestMethod {
  const m = METHODS.find((x) => x.id === id);
  if (!m) throw new Error(`Unknown backtest method: ${id}`);
  return m;
}

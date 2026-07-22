export type SavedMethod = { id: string; name: string; sourceRunId: string; strategyId: string; breakoutPips: number; stopLossPips: number; takeProfitPips: number; lot: number; initialBalance: number; badge?: "FINAL" };
export const SAVED_METHODS: SavedMethod[] = [
  { id: "breakout-h4-prop-firm-baseline", name: "Breakout H4 — Prop Firm Baseline", sourceRunId: "backtest026XAU", strategyId: "xau_h4_breakout", breakoutPips: 25, stopLossPips: 200, takeProfitPips: 400, lot: 0.35, initialBalance: 10000 },
  { id: "breakout-h4-safe", name: "Breakout H4 Safe", sourceRunId: "backtest026XAU", strategyId: "xau_h4_breakout", breakoutPips: 25, stopLossPips: 200, takeProfitPips: 400, lot: 0.30, initialBalance: 10000 },
  { id: "breakout-h4-balanced", name: "Breakout H4 Balanced", sourceRunId: "backtest026XAU", strategyId: "xau_h4_breakout", breakoutPips: 25, stopLossPips: 200, takeProfitPips: 400, lot: 0.32, initialBalance: 10000 },
  { id: "breakout-h4-aggressive", name: "Breakout H4 Aggressive", sourceRunId: "backtest026XAU", strategyId: "xau_h4_breakout", breakoutPips: 25, stopLossPips: 200, takeProfitPips: 400, lot: 0.35, initialBalance: 10000 },
];

export const FINAL_METHOD: SavedMethod = {
  id: "breakout-h4-final",
  name: "Breakout H4 — The5ers Final",
  sourceRunId: "backtest026XAU",
  strategyId: "xau_h4_breakout",
  breakoutPips: 25,
  stopLossPips: 200,
  takeProfitPips: 400,
  lot: 0.30,
  initialBalance: 10000,
  badge: "FINAL",
};

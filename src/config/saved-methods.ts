export type MethodStatus = "ACTIVE" | "ARCHIVED" | "CANDIDATE" | "REJECTED";

export type SavedMethod = {
  id: string;
  name: string;
  sourceRunId: string;
  strategyId: string;
  breakoutPips: number;
  stopLossPips: number;
  takeProfitPips: number;
  lot: number;
  initialBalance: number;
  badge?: "FINAL";
  status: MethodStatus;
  archivedAt?: string;
  archivedReason?: string;
  isFinal: boolean;
  parentMethodId?: string;
  version: number;
  createdFromFinal: boolean;
  archived?: boolean;
  decision?: "KEEP_V1";
};

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
  status: "ACTIVE",
  isFinal: true,
  version: 1,
  createdFromFinal: false,
};

const archivedAt = "2026-07-23T00:00:00.000Z";
const archivedReason = "Archived after The5ers Final became the active method.";

/** Catalog is intentionally retained for audit/restore; archived entries are never deleted. */
export const SAVED_METHODS: SavedMethod[] = [
  FINAL_METHOD,
  { id: "breakout-h4-final-v3a-trade-management", name: "Breakout H4 — The5ers Final V3A Trade Management", sourceRunId: "backtest026XAU", strategyId: "xau_h4_breakout", breakoutPips: 25, stopLossPips: 200, takeProfitPips: 400, lot: 0.30, initialBalance: 10000, status: "REJECTED", archived: true, decision: "KEEP_V1", archivedReason: "Rejected: profit factor, net profit, and drawdown fail versus V1.", isFinal: false, parentMethodId: FINAL_METHOD.id, version: 3, createdFromFinal: true },
  { id: "breakout-h4-final-v3b-trade-management", name: "Breakout H4 — The5ers Final V3B Trade Management", sourceRunId: "backtest026XAU", strategyId: "xau_h4_breakout", breakoutPips: 25, stopLossPips: 200, takeProfitPips: 400, lot: 0.30, initialBalance: 10000, status: "REJECTED", archived: true, decision: "KEEP_V1", archivedReason: "Rejected: profit factor, net profit, and drawdown fail versus V1.", isFinal: false, parentMethodId: FINAL_METHOD.id, version: 3, createdFromFinal: true },
  { id: "breakout-h4-final-v3c-trade-management", name: "Breakout H4 — The5ers Final V3C Trade Management", sourceRunId: "backtest026XAU", strategyId: "xau_h4_breakout", breakoutPips: 25, stopLossPips: 200, takeProfitPips: 400, lot: 0.30, initialBalance: 10000, status: "REJECTED", archived: true, decision: "KEEP_V1", archivedReason: "Rejected: profit factor, net profit, and drawdown fail versus V1.", isFinal: false, parentMethodId: FINAL_METHOD.id, version: 3, createdFromFinal: true },
  { id: "breakout-h4-final-v2-active-window", name: "Breakout H4 — The5ers Final V2 Active Window", sourceRunId: "backtest026XAU", strategyId: "xau_h4_breakout", breakoutPips: 25, stopLossPips: 200, takeProfitPips: 400, lot: 0.30, initialBalance: 10000, status: "REJECTED", archived: true, decision: "KEEP_V1", archivedReason: "Rejected: win rate, profit factor, net profit, and drawdown worsened versus V1.", isFinal: false, parentMethodId: FINAL_METHOD.id, version: 2, createdFromFinal: true },
  { id: "breakout-h4-prop-firm-baseline", name: "Breakout H4 — Prop Firm Baseline", sourceRunId: "backtest026XAU", strategyId: "xau_h4_breakout", breakoutPips: 25, stopLossPips: 200, takeProfitPips: 400, lot: 0.35, initialBalance: 10000, status: "ARCHIVED", archivedAt, archivedReason, isFinal: false, version: 0, createdFromFinal: false },
  { id: "breakout-h4-safe", name: "Breakout H4 Safe", sourceRunId: "backtest026XAU", strategyId: "xau_h4_breakout", breakoutPips: 25, stopLossPips: 200, takeProfitPips: 400, lot: 0.30, initialBalance: 10000, status: "ARCHIVED", archivedAt, archivedReason, isFinal: false, version: 0, createdFromFinal: false },
  { id: "breakout-h4-balanced", name: "Breakout H4 Balanced", sourceRunId: "backtest026XAU", strategyId: "xau_h4_breakout", breakoutPips: 25, stopLossPips: 200, takeProfitPips: 400, lot: 0.32, initialBalance: 10000, status: "ARCHIVED", archivedAt, archivedReason, isFinal: false, version: 0, createdFromFinal: false },
  { id: "breakout-h4-aggressive", name: "Breakout H4 Aggressive", sourceRunId: "backtest026XAU", strategyId: "xau_h4_breakout", breakoutPips: 25, stopLossPips: 200, takeProfitPips: 400, lot: 0.35, initialBalance: 10000, status: "ARCHIVED", archivedAt, archivedReason, isFinal: false, version: 0, createdFromFinal: false },
];

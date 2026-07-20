import type {
  BacktestMetrics,
  BacktestTrade,
  EquityPoint,
  SessionResult,
} from "./types";
import { round2 } from "./execution";

const CLOSED = new Set(["WIN", "LOSS", "BREAKEVEN", "OPEN_AT_END"]);

function sessionOf(entryTime: string): SessionResult["session"] {
  const h = new Date(entryTime).getUTCHours();
  if (h < 9) return "ASIA";
  if (h < 15) return "LONDON";
  return "NEW_YORK";
}

export function computeMetrics(
  trades: BacktestTrade[],
  equity: EquityPoint[],
  initialBalance: number
): BacktestMetrics {
  const closed = trades.filter((t) => CLOSED.has(t.result));
  const wins = closed.filter((t) => t.netProfit > 0);
  const losses = closed.filter((t) => t.netProfit < 0);
  const breakeven = closed.filter((t) => t.netProfit === 0);
  const grossProfit = wins.reduce((s, t) => s + t.netProfit, 0);
  const grossLoss = losses.reduce((s, t) => s + t.netProfit, 0);
  const netProfitTotal = grossProfit + grossLoss;

  let peak = initialBalance;
  let maxDD = 0;
  let maxDDPct = 0;
  for (const p of equity) {
    if (p.balance > peak) peak = p.balance;
    const dd = peak - p.balance;
    if (dd > maxDD) {
      maxDD = dd;
      maxDDPct = peak > 0 ? (dd / peak) * 100 : 0;
    }
  }

  let curWins = 0,
    curLosses = 0,
    maxWins = 0,
    maxLosses = 0;
  for (const t of closed) {
    if (t.netProfit > 0) {
      curWins++;
      curLosses = 0;
    } else if (t.netProfit < 0) {
      curLosses++;
      curWins = 0;
    } else {
      curWins = 0;
      curLosses = 0;
    }
    maxWins = Math.max(maxWins, curWins);
    maxLosses = Math.max(maxLosses, curLosses);
  }

  const dir = (d: "BUY" | "SELL") => {
    const ts = closed.filter((t) => t.direction === d);
    const w = ts.filter((t) => t.netProfit > 0).length;
    return {
      trades: ts.length,
      wins: w,
      losses: ts.filter((t) => t.netProfit < 0).length,
      winRate: ts.length ? round2((w / ts.length) * 100) : 0,
      netProfit: round2(ts.reduce((s, t) => s + t.netProfit, 0)),
    };
  };

  const monthlyMap = new Map<string, { trades: number; netProfit: number }>();
  for (const t of closed) {
    const month = t.entryTime.slice(0, 7);
    const m = monthlyMap.get(month) ?? { trades: 0, netProfit: 0 };
    m.trades++;
    m.netProfit = round2(m.netProfit + t.netProfit);
    monthlyMap.set(month, m);
  }

  const sessions: SessionResult[] = (
    ["ASIA", "LONDON", "NEW_YORK"] as const
  ).map((s) => {
    const ts = closed.filter((t) => sessionOf(t.entryTime) === s);
    return {
      session: s,
      trades: ts.length,
      wins: ts.filter((t) => t.netProfit > 0).length,
      losses: ts.filter((t) => t.netProfit < 0).length,
      netProfit: round2(ts.reduce((sum, t) => sum + t.netProfit, 0)),
    };
  });

  const finalBalance =
    equity.length > 0 ? equity[equity.length - 1].balance : initialBalance;

  return {
    initialBalance,
    finalBalance: round2(finalBalance),
    netProfit: round2(netProfitTotal),
    netProfitPips: round2(closed.reduce((s, t) => s + (t.pips ?? 0), 0)),
    grossProfit: round2(grossProfit),
    grossLoss: round2(grossLoss),
    totalTrades: closed.length,
    winningTrades: wins.length,
    losingTrades: losses.length,
    breakevenTrades: breakeven.length,
    ambiguousTrades: trades.filter((t) => t.result === "AMBIGUOUS").length,
    skippedTrades: trades.filter((t) => t.result === "SKIPPED").length,
    openAtEndTrades: trades.filter((t) => t.result === "OPEN_AT_END").length,
    winRate: closed.length ? round2((wins.length / closed.length) * 100) : 0,
    lossRate: closed.length ? round2((losses.length / closed.length) * 100) : 0,
    profitFactor:
      grossLoss !== 0 ? round2(grossProfit / Math.abs(grossLoss)) : null,
    expectedPayoff: closed.length
      ? round2(netProfitTotal / closed.length)
      : 0,
    averageWin: wins.length ? round2(grossProfit / wins.length) : 0,
    averageLoss: losses.length ? round2(grossLoss / losses.length) : 0,
    largestWin: wins.length
      ? round2(Math.max(...wins.map((t) => t.netProfit)))
      : 0,
    largestLoss: losses.length
      ? round2(Math.min(...losses.map((t) => t.netProfit)))
      : 0,
    maxDrawdown: round2(maxDD),
    maxDrawdownPercent: round2(maxDDPct),
    maxConsecutiveWins: maxWins,
    maxConsecutiveLosses: maxLosses,
    buy: dir("BUY"),
    sell: dir("SELL"),
    monthly: Array.from(monthlyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, m]) => ({ month, ...m })),
    bySession: sessions,
  };
}

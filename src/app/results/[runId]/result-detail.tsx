"use client";

import { useMemo, useState } from "react";
import type {
  BacktestTrade,
  EquityPoint,
  RunSummary,
  StoredConfig,
} from "@/backtest/types";
import { isLegacyRun } from "@/backtest/types";
import { EquityChart, DrawdownChart, MonthlyChart, SessionChart } from "@/components/charts";

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded border border-slate-800 bg-slate-900 p-3">
      <div className="text-[11px] uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-0.5 font-mono text-sm font-semibold">{value}</div>
    </div>
  );
}

/** Dollar format: +$160.00, -$80.00, $0.00 */
export function usd(n: number): string {
  if (n > 0) return `+$${n.toFixed(2)}`;
  if (n < 0) return `-$${Math.abs(n).toFixed(2)}`;
  return "$0.00";
}

const plClass = (n: number) =>
  n > 0 ? "text-emerald-400" : n < 0 ? "text-red-400" : "text-slate-300";

export default function ResultDetail({
  summary,
  trades,
  equity,
}: {
  summary: RunSummary;
  trades: BacktestTrade[];
  equity: EquityPoint[];
}) {
  const [dirFilter, setDirFilter] = useState<"ALL" | "BUY" | "SELL">("ALL");
  const [resFilter, setResFilter] = useState<"ALL" | "WIN" | "LOSS" | "BREAKEVEN" | "SKIPPED">("ALL");
  const [sortAsc, setSortAsc] = useState(true);
  const [showConfig, setShowConfig] = useState(false);
  const m = summary.metrics;
  const cfg = summary.config as Partial<StoredConfig>;
  const h1 = cfg.strategyId === "xau_trend_pullback_h1";
  const dailyStop = cfg.strategyId === "breakout_h4_stop_after_1_loss";
  const dailyPrevious = cfg.strategyId === "daily_previous_candle_breakout";
  const legacy = isLegacyRun(summary);

  const filtered = useMemo(() => {
    let ts = trades;
    if (dirFilter !== "ALL") ts = ts.filter((t) => t.direction === dirFilter);
    if (resFilter !== "ALL") ts = ts.filter((t) => t.result === resFilter);
    return [...ts].sort((a, b) =>
      sortAsc
        ? a.entryTime.localeCompare(b.entryTime)
        : b.entryTime.localeCompare(a.entryTime)
    );
  }, [trades, dirFilter, resFilter, sortAsc]);

  function exportCsv() {
    const cols = Object.keys(trades[0] ?? {});
    const csv = [
      cols.join(","),
      ...trades.map((t) =>
        cols.map((c) => (t as Record<string, unknown>)[c] ?? "").join(",")
      ),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${summary.runId}-trades.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">{summary.runId}</h2>
          <p className="text-sm text-slate-400">
            {cfg.method ?? cfg.methodName ?? "?"} · {cfg.startDate ?? "?"} → {cfg.endDate ?? "?"}
            {legacy && (
              <span className="ml-2 rounded bg-slate-700 px-2 py-0.5 text-xs font-bold text-slate-300">
                Legacy — menggunakan formula lama
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCsv}
            className="rounded border border-slate-700 px-3 py-1.5 text-sm hover:bg-slate-800">
            Export trades CSV
          </button>
          <button onClick={() => setShowConfig((s) => !s)}
            className="rounded border border-slate-700 px-3 py-1.5 text-sm hover:bg-slate-800">
            Config JSON
          </button>
        </div>
      </div>

      {summary.status === "FAILED" && (
        <div className="rounded border border-red-800 bg-red-950 p-3 text-red-300">
          FAILED: {summary.error}
        </div>
      )}
      {summary.warnings.map((w, i) => (
        <div key={i} className="rounded border border-amber-800 bg-amber-950 p-3 text-sm text-amber-300">
          ⚠ {w}
        </div>
      ))}
      {showConfig && (
        <pre className="overflow-x-auto rounded border border-slate-800 bg-slate-900 p-4 text-xs">
          {JSON.stringify(summary.config, null, 2)}
        </pre>
      )}

      {m && (
        <>
          <div className="rounded-lg border border-slate-800 bg-slate-900 p-4 text-sm text-slate-300"><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{h1 ? <><span>Signal: <b>H1</b></span><span>Entry/Management: <b>H1</b></span><span>Indicators: <b>EMA50 / EMA200 / ATR14</b></span><span>Risk Reward: <b>1:2</b></span></> : dailyPrevious ? <><span>Signal: <b>D1 closed</b></span><span>Execution: <b>M1</b></span><span>Entry Offset: <b>{cfg.entryOffset ?? "-"} price</b></span><span>Risk Reward: <b>1:{cfg.riskReward ?? "-"}</b></span></> : <><span>Breakout: <b>{cfg.breakoutPips ?? "-"} pip / {cfg.breakoutPriceDistance?.toFixed(2) ?? "-"} harga</b></span><span>Stop Loss: <b>{cfg.stopLossPips ?? "-"} pip / {cfg.stopLossPriceDistance?.toFixed(2) ?? "-"} harga</b></span><span>Take Profit: <b>{cfg.takeProfitPips ?? "-"} pip / {cfg.takeProfitPriceDistance?.toFixed(2) ?? "-"} harga</b></span><span>Risk Reward: <b>1:{cfg.riskReward ?? "-"}</b></span></>}</div></div>
          {dailyStop && <div className="rounded-lg border border-amber-800 bg-amber-950/30 p-4 text-sm"><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4"><span>Daily Stop Rule: <b>{cfg.dailyStopRule ?? "Stop after 1 realized loss"}</b></span><span>Timezone: <b>{cfg.dailyStopTimezone ?? "UTC"}</b></span><span>Blocked Days: <b>{cfg.dailyBlockedDays ?? 0}</b></span><span>Skipped Signals: <b>{cfg.dailySkippedSignals ?? 0}</b></span><span>Worst Daily Loss: <b>{usd(cfg.worstDailyLoss ?? 0)}</b></span><span>Consecutive Losing Days: <b>{cfg.consecutiveLosingDays ?? 0}</b></span></div></div>}
          {dailyPrevious && <div className="rounded-lg border border-sky-800 bg-sky-950/30 p-4 text-sm"><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4"><span>Previous Daily High: <b>{cfg.previousDailyHigh ?? "-"}</b></span><span>Previous Daily Low: <b>{cfg.previousDailyLow ?? "-"}</b></span><span>Entry Offset: <b>{cfg.entryOffset ?? "-"}</b></span><span>Buy Stop: <b>{cfg.buyStop ?? "-"}</b></span><span>Sell Stop: <b>{cfg.sellStop ?? "-"}</b></span><span>Pending Expired: <b>{cfg.pendingExpiredDays ?? 0}</b></span><span>Days Without Trigger: <b>{cfg.noTriggerDays ?? 0}</b></span><span>Ambiguous Candles: <b>{cfg.dailyAmbiguousCandles ?? 0}</b></span></div></div>}
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-5">
            <Metric label="Method" value={cfg.method ?? cfg.methodName ?? "-"} />
            <Metric label="Lot" value={cfg.lot ?? "-"} />
            <Metric label="Initial Balance" value={cfg.initialBalance ? "$" + cfg.initialBalance.toFixed(2) : "-"} />
            <Metric label="Total Trade" value={m.totalTrades} />
            <Metric label="Win" value={m.winningTrades} />
            <Metric label="Loss" value={m.losingTrades} />
            <Metric label="Break Even" value={m.breakevenTrades} />
            <Metric label="Open at End" value={m.openAtEndTrades} />
            <Metric label="Win Rate" value={<span className="text-amber-400">{m.winRate.toFixed(2)}%</span>} />
            <Metric label="Loss Rate" value={m.lossRate.toFixed(2) + "%"} />
            <Metric label="Profit Factor" value={m.profitFactor ?? "-"} />
            <Metric label="Net Profit" value={<span className={plClass(m.netProfit)}>{usd(m.netProfit)}</span>} />
            <Metric label="Final Balance" value={"$" + m.finalBalance.toFixed(2)} />
            <Metric label="Max Drawdown" value={usd(-m.maxDrawdown)} />
            <Metric label="Max Drawdown %" value={m.maxDrawdownPercent.toFixed(2) + "%"} />
            <Metric label="Consecutive Wins" value={m.maxConsecutiveWins} />
            <Metric label="Consecutive Losses" value={m.maxConsecutiveLosses} />
            <Metric label="Buy Win Rate" value={`${m.buy.winRate.toFixed(2)}% (${m.buy.wins}/${m.buy.trades})`} />
            <Metric label="Sell Win Rate" value={`${m.sell.winRate.toFixed(2)}% (${m.sell.wins}/${m.sell.trades})`} />
            <Metric label="Buy Trades" value={m.buy.trades} />
            <Metric label="Sell Trades" value={m.sell.trades} />
          </div>

          <section className="space-y-2">
            <h3 className="font-semibold">Equity Curve</h3>
            <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-2 sm:p-3">
              <EquityChart equity={equity} />
            </div>
          </section>
          <section className="space-y-2">
            <h3 className="font-semibold">Drawdown</h3>
            <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-2 sm:p-3">
              <DrawdownChart equity={equity} />
            </div>
          </section>
          <section className="space-y-2">
            <h3 className="font-semibold">Profit per Bulan ($)</h3>
            <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-2 sm:p-3">
              <MonthlyChart monthly={m.monthly} />
            </div>
          </section>
          <section>
            <h3 className="mb-2 font-semibold">Hasil per Session</h3>
            <SessionChart sessions={m.bySession} />
          </section>
        </>
      )}

      <section>
        <div className="mb-2 flex flex-wrap items-center gap-3">
          <h3 className="font-semibold">Transaksi ({filtered.length})</h3>
          <select value={dirFilter} onChange={(e) => setDirFilter(e.target.value as never)}
            className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm">
            <option value="ALL">Buy + Sell</option>
            <option value="BUY">Buy</option>
            <option value="SELL">Sell</option>
          </select>
          <select value={resFilter} onChange={(e) => setResFilter(e.target.value as never)}
            className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm">
            <option value="ALL">Semua hasil</option>
            <option value="WIN">Win</option>
            <option value="LOSS">Loss</option>
            <option value="BREAKEVEN">Breakeven</option>
            <option value="SKIPPED">Skipped</option>
          </select>
        </div>
        <div className="max-h-[32rem] overflow-auto rounded-lg border border-slate-800">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-slate-900 text-left text-slate-400">
              <tr>
                <th className="p-2">ID</th>
                <th className="cursor-pointer select-none p-2" onClick={() => setSortAsc((s) => !s)}>
                  Entry Time {sortAsc ? "▲" : "▼"}
                </th>
                <th className="p-2">Direction</th>
                <th className="p-2">Entry</th>
                <th className="p-2">SL</th>
                <th className="p-2">TP</th>
                <th className="p-2">Exit Time</th>
                <th className="p-2">Exit</th>
                <th className="p-2">Result</th>
                <th className="p-2">P/L ($)</th>
                <th className="p-2">Balance</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {filtered.map((t) => (
                <tr key={t.id} className="border-t border-slate-800">
                  <td className="p-2">{t.id}</td>
                  <td className="p-2">{t.entryTime.replace("T", " ").slice(0, 19)}</td>
                  <td className="p-2">{t.direction}</td>
                  <td className="p-2">{t.entryPrice.toFixed(2)}</td>
                  <td className="p-2">{t.stopLoss ? t.stopLoss.toFixed(2) : "-"}</td>
                  <td className="p-2">{t.takeProfit ? t.takeProfit.toFixed(2) : "-"}</td>
                  <td className="p-2">{t.exitTime?.replace("T", " ").slice(0, 19) ?? "-"}</td>
                  <td className="p-2">{t.exitPrice?.toFixed(2) ?? "-"}</td>
                  <td className="p-2">
                    <span className={
                      t.result === "WIN" ? "text-emerald-400"
                        : t.result === "LOSS" ? "text-red-400"
                        : t.result === "SKIPPED" || t.result === "AMBIGUOUS" ? "text-amber-300"
                        : "text-slate-400"
                    }>{t.result}</span>
                  </td>
                  <td className={"p-2 " + plClass(t.netProfit)}>{usd(t.netProfit)}</td>
                  <td className="p-2">{t.balanceAfter.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { strategyRegistry } from "@/strategies/registry";
import { XAU_TREND_PULLBACK_H1_ID } from "@/strategies/xau_trend_pullback_h1/config";
import { DAILY_PREVIOUS_CANDLE_BREAKOUT_ID } from "@/strategies/daily_previous_candle_breakout";

const input = "w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm";

export default function BatchBacktestPage() {
  const router = useRouter();
  const [strategyId, setStrategyId] = useState("xau_h4_breakout"); const visibleStrategies = strategyRegistry.filter((s) => s.id === "xau_h4_breakout");
  const [startDate, setStart] = useState("2022-01-03");
  const [endDate, setEnd] = useState("");
  const [breakout, setBreakout] = useState("5,10,15,20,25");
  const [sl, setSl] = useState("150,200,250");
  const [tp, setTp] = useState("300,400,500");
  const [lot, setLot] = useState("0.35");
  const [balance, setBalance] = useState("10000");
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  const isH1 = strategyId === XAU_TREND_PULLBACK_H1_ID;
  const isDaily = strategyId === DAILY_PREVIOUS_CANDLE_BREAKOUT_ID;

  useEffect(() => {
    fetch("/api/data/status").then((r) => r.json()).then((s) => {
      const source = isDaily ? s.d1 : isH1 ? s.h1 : s.h4;
      setEnd(source?.lastDate?.slice(0, 10) || "");
    }).catch(() => {});
  }, [isH1, isDaily]);

  const count = () => isH1 || isDaily ? 1 : breakout.split(",").filter(Boolean).length * sl.split(",").filter(Boolean).length * tp.split(",").filter(Boolean).length;

  async function run() {
    if (running) return;
    setError("");
    if (!endDate || startDate > endDate || count() > 100) return setError("Periksa tanggal dan pastikan maksimal 100 kombinasi.");
    setRunning(true);
    try {
      const body = isH1
        ? { strategyId, startDate, endDate, lot: Number(lot || 0.35), initialBalance: Number(balance || 10000) }
        : isDaily
          ? { strategyId, startDate, endDate, entryOffset: Number(breakout || 10), stopLossPips: Number(sl || 200), takeProfitPips: Number(tp || 400), lot: Number(lot || 0.35), initialBalance: Number(balance || 10000) }
          : { strategyId, startDate, endDate, breakoutPips: breakout, stopLossPips: sl, takeProfitPips: tp, lot: Number(lot || 0.4), initialBalance: Number(balance || 10000) };
      const res = await fetch("/api/batch-backtest/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Batch gagal dibuat."); setRunning(false); return; }
      router.push(data.processingUrl);
    } catch { setError("Tidak dapat membuat batch."); setRunning(false); }
  }

  return <div className="max-w-4xl space-y-6">
    <div><h2 className="text-2xl font-bold">Batch Backtest / Grid Search</h2><p className="mt-1 text-sm text-slate-400">Pilih strategi; parameter tidak dicampur antar strategyId.</p></div>
    <div className="grid gap-4 rounded-lg border border-slate-800 bg-slate-900 p-4 md:grid-cols-2">
      <label className="text-sm md:col-span-2">Strategy<select className={input + " mt-1"} value={strategyId} onChange={(e) => setStrategyId(e.target.value)}>{visibleStrategies.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      <label className="text-sm">Lot<input className={input + " mt-1"} value={lot} onChange={(e) => setLot(e.target.value)} /></label>
      <label className="text-sm">Initial Balance<input className={input + " mt-1"} value={balance} onChange={(e) => setBalance(e.target.value)} /></label>
      <label className="text-sm">Tanggal mulai<input type="date" className={input + " mt-1"} value={startDate} onChange={(e) => setStart(e.target.value)} /></label>
      <label className="text-sm">Tanggal selesai<input type="date" className={input + " mt-1"} value={endDate} onChange={(e) => setEnd(e.target.value)} /></label>
      <div className="rounded border border-slate-800 bg-slate-950 p-3 text-sm"><div className="text-slate-400">Estimasi</div><div className="mt-1 text-lg font-semibold text-amber-300">{count()} kombinasi</div></div>
      {isH1 ? <div className="rounded border border-slate-800 bg-slate-950 p-3 text-sm md:col-span-2"><b>XAU Trend Pullback H1</b><p className="mt-1 text-slate-400">EMA50 / EMA200 / ATR14, RR 1:2, entry dan manajemen posisi H1.</p></div> : isDaily ? <><label className="text-sm md:col-span-2">Entry Offset (harga absolut)<input className={input + " mt-1"} value={breakout} onChange={(e) => setBreakout(e.target.value)} /></label><label className="text-sm md:col-span-2">Stop Loss (pip)<input className={input + " mt-1"} value={sl} onChange={(e) => setSl(e.target.value)} /></label><label className="text-sm md:col-span-2">Take Profit (pip)<input className={input + " mt-1"} value={tp} onChange={(e) => setTp(e.target.value)} /></label></> : <><label className="text-sm md:col-span-2">Breakout Pips<input className={input + " mt-1"} value={breakout} onChange={(e) => setBreakout(e.target.value)} /></label><label className="text-sm md:col-span-2">Stop Loss Pips<input className={input + " mt-1"} value={sl} onChange={(e) => setSl(e.target.value)} /></label><label className="text-sm md:col-span-2">Take Profit Pips<input className={input + " mt-1"} value={tp} onChange={(e) => setTp(e.target.value)} /></label></>}
    </div>
    {error && <p className="rounded border border-red-800 bg-red-950 p-3 text-sm text-red-300">{error}</p>}
    <button onClick={run} disabled={running} className="rounded bg-amber-500 px-5 py-2 font-semibold text-slate-950 disabled:opacity-50">{running ? "Creating Batch..." : "Run Batch Backtest"}</button>
  </div>;
}

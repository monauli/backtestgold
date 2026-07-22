"use client";

import { useEffect, useState } from "react";
import {
  normalizeHistoryRecord,
  safeFixed,
} from "@/lib/prop-firm-simulator/format";
import { isSimulationHistoryRecord } from "@/lib/prop-firm-simulator/history";

type Item = {
  simulationId: string;
  createdAt: string;
  methodName: string;
  startDate: string;
  endDate: string;
  selectedLot: number | null;
  propFirmProgramName: string;
  fullChallengePassRate: number | null;
  fullPass: number | null;
  fullFail: number | null;
  step1Pass: number | null;
  step1Fail: number | null;
  medianStep1Days: number | null;
  medianStep2Days: number | null;
  worstDailyLoss: number | null;
  maximumDrawdown: number | null;
  dailyLossBuffer: number | null;
  totalLossBuffer: number | null;
  dailyLossBreaches: number | null;
  maximumLossBreaches: number | null;
  recommendationStatus?: "LAYAK" | "DITOLAK";
  recommendationReason?: string;
  simulatorVersion: string;
};

function normalize(item: Item): Item {
  return normalizeHistoryRecord(item as unknown as Record<string, unknown>) as unknown as Item;
}

function recommendation(item: Item) {
  return normalize(item).recommendationStatus === "LAYAK";
}

function currency(value: number | null) {
  const formatted = safeFixed(value, 2);
  return formatted === "-" ? "-" : `$${formatted}`;
}

export default function History() {
  const [items, setItems] = useState<Item[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [detail, setDetail] = useState<Item | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = () => {
    setBusy(true);
    fetch("/api/prop-firm")
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((payload) => setItems((payload.history ?? []).filter(isSimulationHistoryRecord).map((item: Item) => normalize(item))))
      .catch(() => setError("Tidak dapat memuat Simulation History."))
      .finally(() => setBusy(false));
  };

  useEffect(() => {
    load();
    const refresh = () => load();
    window.addEventListener("prop-firm-history-refresh", refresh);
    return () => window.removeEventListener("prop-firm-history-refresh", refresh);
  }, []);

  async function view(id: string) {
    const response = await fetch(`/api/prop-firm/${id}`);
    if (!response.ok) {
      setError("Detail simulation tidak ditemukan.");
      return;
    }
    setDetail(normalize(await response.json()));
  }

  async function remove(id: string) {
    if (!confirm("Hapus simulation history ini? Source backtest tidak akan dihapus.")) return;
    const response = await fetch(`/api/prop-firm/${id}`, { method: "DELETE" });
    if (!response.ok) {
      setError("Simulation gagal dihapus.");
      return;
    }
    setSelected((value) => value.filter((item) => item !== id));
    setMessage("Simulation deleted");
    load();
  }

  const compared = items.filter((item) => selected.includes(item.simulationId));

  return (
    <section className="overflow-x-auto rounded border border-slate-800 bg-slate-900 p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-amber-300">Simulation History</h3>
        <button disabled={compared.length < 2} className="rounded border border-amber-500 px-3 py-1 text-sm text-amber-300 disabled:opacity-40">
          Compare Selected
        </button>
      </div>
      {busy && <p className="mt-3 text-sm text-slate-400">Loading history...</p>}
      {!busy && !items.length && <p className="mt-3 text-sm text-slate-400">Belum ada simulation history.</p>}
      {error && <p className="mt-3 rounded border border-red-800 bg-red-950 p-2 text-sm text-red-300">{error}</p>}
      {message && <p className="mt-2 text-sm text-emerald-400">{message}</p>}
      {items.length > 0 && (
        <table className="mt-3 w-full text-sm">
          <thead><tr className="text-left text-slate-400">
            <th className="p-2">Select</th><th className="p-2">Tanggal</th><th className="p-2">Metode</th>
            <th className="p-2">Periode</th><th className="p-2">Lot</th><th className="p-2">Full pass</th>
            <th className="p-2">Worst daily loss</th><th className="p-2">Maximum DD</th>
            <th className="p-2">Recommendation</th><th className="p-2">Actions</th>
          </tr></thead>
          <tbody>{items.map((item) => {
            const normalized = normalize(item);
            const eligible = recommendation(normalized);
            return <tr className="border-t border-slate-800" key={item.simulationId}>
              <td className="p-2"><input type="checkbox" checked={selected.includes(item.simulationId)} onChange={() => setSelected((value) => value.includes(item.simulationId) ? value.filter((id) => id !== item.simulationId) : value.length < 3 ? [...value, item.simulationId] : value)} /></td>
              <td className="p-2">{new Date(item.createdAt).toLocaleString()}</td>
              <td className="p-2">{item.methodName}</td>
              <td className="p-2">{item.startDate} → {item.endDate}</td>
              <td className="p-2">{safeFixed(item.selectedLot, 2)}</td>
              <td className="p-2">{safeFixed(item.fullChallengePassRate, 1)}%</td>
              <td className="p-2">{currency(item.worstDailyLoss)}</td>
              <td className="p-2">{currency(item.maximumDrawdown)}</td>
              <td className={eligible ? "p-2 text-emerald-300" : "p-2 text-red-300"}>{normalized.recommendationStatus ?? "DITOLAK"}</td>
              <td className="p-2"><button onClick={() => view(item.simulationId)} className="mr-2 text-amber-300">View</button><button onClick={() => remove(item.simulationId)} className="text-red-300">Delete</button></td>
            </tr>;
          })}</tbody>
        </table>
      )}
      {detail && <Detail item={detail} onClose={() => setDetail(null)} />}
      {compared.length >= 2 && <Compare items={compared} />}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string | number | null }) {
  return <div className="rounded border border-slate-800 p-2"><div className="text-xs text-slate-500">{label}</div><div className="font-semibold">{value ?? "-"}</div></div>;
}

function Detail({ item, onClose }: { item: Item; onClose: () => void }) {
  const normalized = normalize(item);
  return <div className="mt-4 rounded border border-amber-800 bg-slate-950 p-4">
    <div className="flex justify-between"><h4 className="font-semibold text-amber-300">Simulation Detail</h4><button onClick={onClose}>Close</button></div>
    <p className="mt-2 text-sm">{item.methodName} · {item.startDate} → {item.endDate} · lot {safeFixed(item.selectedLot, 2)} · {item.propFirmProgramName}</p>
    <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
      <Metric label="Simulation date" value={new Date(item.createdAt).toLocaleString()} />
      <Metric label="Full pass" value={`${safeFixed(item.fullChallengePassRate, 1)}% (${safeFixed(item.fullPass, 0)}/${safeFixed(item.fullFail, 0)})`} />
      <Metric label="Step 1" value={`${safeFixed(item.step1Pass, 0)}/${safeFixed(item.step1Fail, 0)}`} />
      <Metric label="Median Step 1/2 days" value={`${safeFixed(item.medianStep1Days, 0)}/${safeFixed(item.medianStep2Days, 0)}`} />
      <Metric label="Worst daily loss" value={currency(item.worstDailyLoss)} />
      <Metric label="Maximum drawdown" value={currency(item.maximumDrawdown)} />
      <Metric label="Buffers" value={`daily ${currency(item.dailyLossBuffer)} / total ${currency(item.totalLossBuffer)}`} />
      <Metric label="Breaches" value={`daily ${safeFixed(item.dailyLossBreaches, 0)} / total ${safeFixed(item.maximumLossBreaches, 0)}`} />
      <Metric label="Recommendation" value={normalized.recommendationStatus ?? "DITOLAK"} />
      <Metric label="Version" value={item.simulatorVersion} />
    </div>
    <p className="mt-3 text-sm text-slate-300">{normalized.recommendationReason ?? "-"}</p>
  </div>;
}

function Compare({ items }: { items: Item[] }) {
  const winner = [...items].filter((item) => recommendation(item)).sort((a, b) => (b.selectedLot ?? -Infinity) - (a.selectedLot ?? -Infinity))[0];
  return <div className="mt-4 rounded border border-emerald-800 p-4"><h4 className="font-semibold text-emerald-300">Compare Selected</h4>
    <table className="mt-2 w-full text-sm"><thead><tr className="text-left text-slate-400"><th className="p-2">Method</th><th className="p-2">Period</th><th className="p-2">Lot</th><th className="p-2">Full pass</th><th className="p-2">Median Step 1</th><th className="p-2">Median Step 2</th><th className="p-2">Worst loss</th><th className="p-2">Maximum DD</th><th className="p-2">Daily buffer</th><th className="p-2">Total buffer</th></tr></thead>
      <tbody>{items.map((item) => <tr className="border-t border-slate-800" key={item.simulationId}><td className="p-2">{item.methodName}</td><td className="p-2">{item.startDate} → {item.endDate}</td><td className="p-2">{safeFixed(item.selectedLot, 2)}</td><td className="p-2">{safeFixed(item.fullChallengePassRate, 1)}%</td><td className="p-2">{safeFixed(item.medianStep1Days, 0)}</td><td className="p-2">{safeFixed(item.medianStep2Days, 0)}</td><td className="p-2">{currency(item.worstDailyLoss)}</td><td className="p-2">{currency(item.maximumDrawdown)}</td><td className="p-2">{currency(item.dailyLossBuffer)}</td><td className="p-2">{currency(item.totalLossBuffer)}</td></tr>)}</tbody>
    </table><p className="mt-2 text-sm text-amber-300">Recommendation: {winner?.methodName ?? "No method meets all thresholds"}</p>
  </div>;
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function IndexButton({ timeframe = "H4M1" }: { timeframe?: "H1" | "H4M1" }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function build() {
    if (busy) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    if (!confirm("Build/Rebuild Data Index membaca file M1 besar dan dapat memerlukan beberapa menit. Lanjutkan?")) { setBusy(false); return; }
    try {
      const res = await fetch("/api/data/index", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ timeframes: timeframe === "H1" ? ["H1"] : ["H4", "M1"] }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setMessage(timeframe === "H1" ? `Index READY: H1 ${data.h1.candleCount.toLocaleString()} candle.` : `Index READY: H4 ${data.h4.candleCount.toLocaleString()} candle, M1 ${data.m1.candleCount.toLocaleString()} candle.`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <span>
      <button
        onClick={build}
        disabled={busy}
        className="rounded border border-amber-600 px-4 py-2 font-semibold text-amber-400 hover:bg-amber-950 disabled:opacity-50"
      >
        {busy ? "Indexing…" : timeframe === "H1" ? "Build H1 Index" : "Build Data Index"}
      </button>
      {error && <span className="ml-3 text-sm text-red-400">{error}</span>}
      {message && <span className="ml-3 text-sm text-emerald-400">{message}</span>}
    </span>
  );
}

import Link from "next/link";
import { getDataStatus } from "@/data/status";
import { readIndex } from "@/backtest/report";
import { isLegacyRun, type CacheMeta } from "@/backtest/types";
import IndexButton from "./index-button";
import { getDataStorageMode } from "@/data/repository-factory";
import { getMongoDb } from "@/lib/mongodb";

type CloudRunCard = { runId: string; status?: string; summary?: { winRate?: number }; createdAt?: Date };

export const dynamic = "force-dynamic";

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
      <div className="text-xs uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}

function CacheBadge({ meta }: { meta: CacheMeta }) {
  const color =
    meta.status === "READY"
      ? "text-emerald-400"
      : meta.status === "INDEXING"
        ? "text-amber-400"
        : "text-red-400";
  return (
    <span className={color}>
      {meta.status}
      {meta.status === "READY" && ` · ${meta.candleCount.toLocaleString()} candle`}
    </span>
  );
}

async function CloudDashboard() {
  let runs: CloudRunCard[] = []; let error = ""; try { const db = await getMongoDb(); const completed = await db.collection<CloudRunCard>("backtest_runs").find({}).sort({ createdAt: -1 }).limit(100).toArray(); const ids = completed.map((x) => x.runId); const jobs = await db.collection<CloudRunCard>("backtest_jobs").find({ runId: { $nin: ids } }).sort({ createdAt: -1 }).limit(100).toArray(); runs = [...completed.map((x) => ({ ...x, status: "COMPLETED" })), ...jobs]; } catch (e) { error = e instanceof Error ? e.message : String(e); }
  const best = [...runs].sort((a, b) => (b.summary?.winRate ?? 0) - (a.summary?.winRate ?? 0))[0]; const last = runs[0];
  return <div className="space-y-6"><h2 className="text-2xl font-bold">Dashboard</h2>{error && <p className="rounded border border-red-800 bg-red-950 p-3 text-sm text-red-300">MongoDB: koneksi gagal</p>}<div className="grid grid-cols-2 gap-4 lg:grid-cols-4"><Stat label="Mode" value="Cloud Database" /><Stat label="Total backtest" value={runs.length} /><Stat label="Backtest terakhir" value={last ? <Link className="text-amber-400 hover:underline" href={last.status === "COMPLETED" ? `/results/${last.runId}` : `/backtests/${last.runId}/processing`}>{last.runId} ({last.status})</Link> : "-"} /><Stat label="Win rate terbaik" value={best?.summary?.winRate ? `${best.summary.winRate.toFixed(2)}% · ${best.runId}` : "-"} /></div><Link href="/new" className="inline-block rounded bg-amber-500 px-4 py-2 font-semibold text-slate-950">New Backtest</Link></div>;
}

export default async function Dashboard() {
  if (getDataStorageMode() === "MONGODB") return <CloudDashboard />;
  const status = getDataStatus();
  const runs = readIndex();
  const completed = runs.filter(
    (r) => r.status === "COMPLETED" && r.metrics && !isLegacyRun(r)
  );
  const last = [...completed].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const best = completed.reduce(
    (b, r) => (!b || r.metrics!.winRate > b.metrics!.winRate ? r : b),
    null as (typeof runs)[number] | null
  );
  const needIndex = status.h4.status !== "READY" || status.m1.status !== "READY";
  const cfgName = (r: (typeof runs)[number]) =>
    (r.config as { method?: string; methodName?: string }).method ?? (r.config as { methodName?: string }).methodName ?? "Legacy";
  const lastCfg = last?.config as { breakoutPips?: number; stopLossPips?: number; takeProfitPips?: number } | undefined;
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Dashboard</h2>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Status data H4" value={<CacheBadge meta={status.h4} />} />
        <Stat label="Status data M1" value={<CacheBadge meta={status.m1} />} />
        <Stat
          label="Periode data"
          value={
            status.h4.firstDate
              ? `${status.h4.firstDate.slice(0, 10)} → ${status.h4.lastDate?.slice(0, 10)}`
              : "-"
          }
        />
        <Stat label="Total backtest" value={runs.length} />
        <Stat
          label="Backtest terakhir"
          value={
            last ? (
              <Link className="text-amber-400 hover:underline" href={`/results/${last.runId}`}>
                {last.runId} ({last.status})
              </Link>
            ) : (
              "-"
            )
          }
        />
        <Stat
          label="Win rate terbaik"
          value={
            best ? (
              <Link className="text-amber-400 hover:underline" href={`/results/${best.runId}`}>
                {cfgName(best)} · WR {best.metrics!.winRate.toFixed(2)}% · {best.metrics!.totalTrades} trade · PF {best.metrics!.profitFactor ?? "-"}
              </Link>
            ) : (
              "-"
            )
          }
        />
        <Stat label="Konfigurasi backtest terakhir" value={last ? `Breakout ${lastCfg?.breakoutPips ?? "-"} · SL ${lastCfg?.stopLossPips ?? "-"} · TP ${lastCfg?.takeProfitPips ?? "-"} pip` : "-"} />
      </div>
      <div className="flex gap-3">
        <Link
          href="/new"
          className="inline-block rounded bg-amber-500 px-4 py-2 font-semibold text-slate-950 hover:bg-amber-400"
        >
          New Backtest
        </Link>
        {needIndex && <IndexButton />}
      </div>
      {needIndex && (
        <p className="text-sm text-amber-300">
          Data belum diindeks. Klik &quot;Build Data Index&quot; (sekali saja; M1 354 MB
          dapat memakan 1–2 menit) atau jalankan backtest — index dibuat otomatis.
        </p>
      )}
    </div>
  );
}

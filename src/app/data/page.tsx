import { getDataStatus } from "@/data/status";
import type { CacheMeta } from "@/backtest/types";
import IndexButton from "../index-button";
import { DATA_DIR, findDataFile } from "@/data/validator";
import { getDataStorageMode } from "@/data/repository-factory";
import { getMongoDb } from "@/lib/mongodb";
import type { DataSyncState } from "@/lib/cloud-types";

export const dynamic = "force-dynamic";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between border-b border-slate-800 py-2 text-sm">
      <span className="text-slate-400">{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}

const STATUS_STYLE: Record<string, string> = {
  READY: "bg-emerald-900 text-emerald-300",
  INDEXING: "bg-amber-900 text-amber-300",
  NOT_INDEXED: "bg-slate-700 text-slate-300",
  FAILED: "bg-red-900 text-red-300",
};

function FileCard({ s }: { s: CacheMeta }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold">{s.timeframe}</h3>
        <span className={"rounded px-2 py-0.5 text-xs font-bold " + STATUS_STYLE[s.status]}>
          {s.status}
        </span>
      </div>
      <Row label="File sumber" value={s.sourceFile} />
      <Row label="Ukuran file sumber" value={`${(s.sourceFileSize / 1024 / 1024).toFixed(2)} MB`} />
      <Row label="Fingerprint" value={`${s.fingerprint.size} bytes · ${new Date(s.fingerprint.mtimeMs).toLocaleString()}`} />
      {s.status === "READY" && (
        <>
          <Row label="Tanggal awal" value={s.firstDate?.replace("T", " ").slice(0, 19) ?? "-"} />
          <Row label="Tanggal akhir" value={s.lastDate?.replace("T", " ").slice(0, 19) ?? "-"} />
          <Row label="Jumlah candle" value={s.candleCount.toLocaleString()} />
          <Row label="Duplicate" value={s.duplicateCount} />
          <Row label="Invalid" value={s.invalidCount} />
          <Row label="Out of order" value={s.outOfOrderCount} />
          <Row label="Gap" value={s.gapCount} />
          <Row label="Diindeks" value={s.indexedAt.replace("T", " ").slice(0, 19)} />
          <Row label="Ukuran cache" value={`${(s.cacheFileSize / 1024 / 1024).toFixed(2)} MB`} />
        </>
      )}
      {s.error && <p className="mt-2 text-sm text-red-400">{s.error}</p>}
    </div>
  );
}

async function CloudDataPage() {
  let states: DataSyncState[] = []; let error = "";
  try { states = await (await getMongoDb()).collection<DataSyncState>("data_sync_state").find({ symbol: "XAUUSD" }).sort({ timeframe: 1 }).toArray(); } catch (e) { error = e instanceof Error ? e.message : String(e); }
  return <div className="space-y-6"><h2 className="text-2xl font-bold">Data XAUUSD</h2><div className="rounded-lg border border-cyan-800 bg-cyan-950/30 p-4"><div className="font-semibold text-cyan-300">Cloud Database</div><p className="mt-1 text-sm text-slate-300">Data permanen production berasal dari MongoDB Atlas. Cron sync tetap server-side dan tidak mengekspos secret.</p></div>{error && <p className="rounded border border-red-800 bg-red-950 p-3 text-sm text-red-300">MongoDB: koneksi gagal</p>}<div className="grid gap-4 lg:grid-cols-3">{(["M1", "H1", "H4"] as const).map((tf) => { const s = states.find((x) => x.timeframe === tf); return <div key={tf} className="rounded-lg border border-slate-800 bg-slate-900 p-4"><div className="flex justify-between"><h3 className="font-semibold">{tf}</h3><span className="text-xs text-amber-300">{s?.status ?? "NOT_IMPORTED"}</span></div><Row label="Jumlah candle" value={s?.candleCount ?? 0} /><Row label="Tanggal awal" value={s?.firstTimestamp?.toISOString() ?? "-"} /><Row label="Tanggal akhir" value={s?.lastClosedTimestamp?.toISOString() ?? "-"} /><Row label="Last success" value={s?.lastSuccessAt?.toISOString() ?? "-"} /><Row label="Source" value="MT5 CSV" /><Row label="Provider" value="Not Configured" />{s?.lastError && <p className="mt-2 text-sm text-red-300">Import gagal</p>}</div>; })}</div><p className="text-xs text-slate-500">Sync dijalankan melalui endpoint cron terproteksi. Provider belum dikonfigurasi.</p></div>;
}

export default async function DataPage() {
  if (getDataStorageMode() === "MONGODB") return <CloudDataPage />;
  const status = getDataStatus();
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Data XAUUSD</h2>
      <p className="text-sm text-slate-400">
        CSV sumber dikonversi sekali ke index biner lokal (folder{" "}
        <code>data-cache/</code>). Halaman ini hanya membaca metadata index —
        CSV mentah tidak dibaca ulang. Index dibangun ulang otomatis jika file
        sumber berubah (fingerprint: path + ukuran + modified time).
      </p>
      <IndexButton />
      <p className="text-xs text-slate-400">Folder diperiksa: <code>{DATA_DIR}</code></p>
      <p className="text-xs text-slate-400">H4 ditemukan: <code>{findDataFile("H4")?.split(/[\\/]/).pop() ?? "-"}</code> · M1 ditemukan: <code>{findDataFile("M1")?.split(/[\\/]/).pop() ?? "-"}</code></p>
      <p className="text-xs text-slate-500">Gap akhir pekan adalah normal pada data pasar dan tidak otomatis berarti data rusak.</p>
      <div className="grid gap-4 lg:grid-cols-2">
        <FileCard s={status.h4} />
        <FileCard s={status.m1} />
        <FileCard s={status.h1} />
      </div>
      <div><IndexButton timeframe="H1" /><p className="mt-2 text-xs text-slate-500">Cache H1 terpisah dan tidak dibangun otomatis saat Dashboard dibuka.</p></div>
    </div>
  );
}

import fs from "fs";
import path from "path";
import type { Candle, CacheMeta } from "@/backtest/types";
import { streamCandles, emptyStats } from "./csv-loader";
import { findDataFile, sourceNotFoundMessage } from "./validator";

/**
 * Lightweight local index: the source CSV is converted once into a flat
 * binary file (5 float64 per candle: ts, open, high, low, close) plus a
 * meta.json holding stats and a source-file fingerprint. Dashboards read only
 * the meta; backtests binary-search the .bin and stream just the needed
 * range. Source CSVs are never modified.
 */
export const CACHE_DIR = path.join(process.cwd(), "data-cache");
const RECORD_SIZE = 5 * 8;

const binPath = (tf: string) => path.join(CACHE_DIR, `${tf}.bin`);
const metaPath = (tf: string) => path.join(CACHE_DIR, `${tf}.meta.json`);
const indexingPath = (tf: string) => path.join(CACHE_DIR, `${tf}.indexing.json`);

function fingerprint(file: string) {
  const st = fs.statSync(file);
  return { path: file, size: st.size, mtimeMs: st.mtimeMs };
}

function sameFingerprint(a: CacheMeta["fingerprint"], b: CacheMeta["fingerprint"]) {
  return a.path === b.path && a.size === b.size && a.mtimeMs === b.mtimeMs;
}

export function readMeta(tf: "H1" | "H4" | "M1"): CacheMeta | null {
  try {
    return JSON.parse(fs.readFileSync(metaPath(tf), "utf8"));
  } catch {
    return null;
  }
}

/** Cache state for a timeframe without touching the source CSV contents. */
export function cacheStatus(tf: "H1" | "H4" | "M1"): CacheMeta {
  const source = findDataFile(tf);
  const notIndexed = (extra: Partial<CacheMeta> = {}): CacheMeta => ({
    status: "NOT_INDEXED",
    timeframe: tf,
    sourceFile: source ? path.basename(source) : "(not found)",
    fingerprint: source ? fingerprint(source) : { path: "", size: 0, mtimeMs: 0 },
    candleCount: 0,
    firstDate: null,
    lastDate: null,
    duplicateCount: 0,
    invalidCount: 0,
    outOfOrderCount: 0,
    gapCount: 0,
    indexedAt: "",
    sourceFileSize: source ? fs.statSync(source).size : 0,
    cacheFileSize: 0,
    ...extra,
  });
  const meta = readMeta(tf);
  try { if (fs.existsSync(indexingPath(tf))) return JSON.parse(fs.readFileSync(indexingPath(tf), "utf8")); } catch { /* fall through to last stable metadata */ }
  // A previously built binary cache remains usable even when the original CSV
  // is not mounted in this workspace. Rebuild is only possible when a source
  // file exists and its fingerprint has changed.
  if (!source) {
    if (meta?.status === "READY" && fs.existsSync(binPath(tf))) {
      return {
        ...meta,
        sourceFileSize: meta.sourceFileSize ?? meta.fingerprint.size,
        cacheFileSize: meta.cacheFileSize ?? fs.statSync(binPath(tf)).size,
      };
    }
    return notIndexed({ status: "FAILED", error: "Source CSV not found" });
  }
  if (!meta) return notIndexed();
  if (meta.status === "READY" && !sameFingerprint(meta.fingerprint, fingerprint(source))) {
    return notIndexed(); // source changed -> reindex needed
  }
  if (meta.status === "READY" && !fs.existsSync(binPath(tf))) return notIndexed();
  return {
    ...meta,
    sourceFileSize: meta.sourceFileSize ?? meta.fingerprint.size,
    cacheFileSize: meta.cacheFileSize ?? (fs.existsSync(binPath(tf)) ? fs.statSync(binPath(tf)).size : 0),
  };
}

const TF_MS: Record<string, number> = { H1: 3600_000, H4: 4 * 3600_000, M1: 60_000 };

function isWeekendGap(prevTs: number, ts: number): boolean {
  const gap = ts - prevTs;
  return gap <= 3 * 24 * 3600_000 && new Date(prevTs).getUTCDay() === 5;
}

/** Build (or rebuild) the binary cache for a timeframe from the source CSV. */
export async function buildCache(tf: "H1" | "H4" | "M1"): Promise<CacheMeta> {
  const source = findDataFile(tf);
  if (!source) throw new Error(sourceNotFoundMessage(tf));
  const fp = fingerprint(source);
  const base: CacheMeta = {
    status: "INDEXING",
    timeframe: tf,
    sourceFile: path.basename(source),
    fingerprint: fp,
    candleCount: 0,
    firstDate: null,
    lastDate: null,
    duplicateCount: 0,
    invalidCount: 0,
    outOfOrderCount: 0,
    gapCount: 0,
    indexedAt: new Date().toISOString(),
    sourceFileSize: fp.size,
    cacheFileSize: 0,
  };
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(indexingPath(tf), JSON.stringify(base, null, 2));
  const tmp = binPath(tf) + ".tmp";
  const oldBin = binPath(tf) + ".previous";
  try {
    const stats = emptyStats();
    const out = fs.createWriteStream(tmp);
    const step = TF_MS[tf];
    let count = 0;
    let first: number | null = null;
    let prev: number | null = null;
    let gaps = 0;
    const buf = Buffer.allocUnsafe(RECORD_SIZE * 4096);
    let bufUsed = 0;
    const flush = () =>
      new Promise<void>((res, rej) => {
        if (bufUsed === 0) return res();
        const chunk = Buffer.from(buf.subarray(0, bufUsed));
        bufUsed = 0;
        out.write(chunk, (e) => (e ? rej(e) : res()));
      });
    for await (const c of streamCandles(source, stats)) {
      if (first === null) first = c.timestamp;
      if (prev !== null && c.timestamp - prev > step && !isWeekendGap(prev, c.timestamp)) gaps++;
      buf.writeDoubleLE(c.timestamp, bufUsed);
      buf.writeDoubleLE(c.open, bufUsed + 8);
      buf.writeDoubleLE(c.high, bufUsed + 16);
      buf.writeDoubleLE(c.low, bufUsed + 24);
      buf.writeDoubleLE(c.close, bufUsed + 32);
      bufUsed += RECORD_SIZE;
      if (bufUsed === buf.length) await flush();
      count++;
      prev = c.timestamp;
    }
    await flush();
    await new Promise<void>((res, rej) => out.end((e?: Error | null) => (e ? rej(e) : res())));
    fs.rmSync(oldBin, { force: true });
    if (fs.existsSync(binPath(tf))) fs.renameSync(binPath(tf), oldBin);
    try { fs.renameSync(tmp, binPath(tf)); } catch (e) { if (fs.existsSync(oldBin)) fs.renameSync(oldBin, binPath(tf)); throw e; }
    const meta: CacheMeta = {
      ...base,
      status: "READY",
      candleCount: count,
      firstDate: first !== null ? new Date(first).toISOString() : null,
      lastDate: prev !== null ? new Date(prev).toISOString() : null,
      duplicateCount: stats.duplicateRows,
      invalidCount: stats.invalidRows,
      outOfOrderCount: stats.outOfOrderRows,
      gapCount: gaps,
      indexedAt: new Date().toISOString(),
      sourceFileSize: fp.size,
      cacheFileSize: fs.statSync(binPath(tf)).size,
    };
    const metaTmp = metaPath(tf) + ".tmp";
    fs.writeFileSync(metaTmp, JSON.stringify(meta, null, 2));
    fs.renameSync(metaTmp, metaPath(tf));
    fs.rmSync(oldBin, { force: true });
    fs.rmSync(indexingPath(tf), { force: true });
    return meta;
  } catch (e) {
    fs.rmSync(tmp, { force: true });
    if (fs.existsSync(oldBin)) {
      fs.rmSync(binPath(tf), { force: true });
      fs.renameSync(oldBin, binPath(tf));
    }
    fs.rmSync(indexingPath(tf), { force: true });
    throw e;
  }
}

/** Ensure a READY cache exists (build if missing/stale) and return its meta. */
export async function ensureCache(tf: "H1" | "H4" | "M1"): Promise<CacheMeta> {
  const st = cacheStatus(tf);
  if (st.status === "READY") return st;
  return buildCache(tf);
}

function readRecord(fd: number, index: number, buf: Buffer): number {
  fs.readSync(fd, buf, 0, RECORD_SIZE, index * RECORD_SIZE);
  return buf.readDoubleLE(0);
}

/** First record index with timestamp >= target (binary search on the .bin). */
function lowerBound(fd: number, count: number, target: number): number {
  const buf = Buffer.allocUnsafe(RECORD_SIZE);
  let lo = 0,
    hi = count;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (readRecord(fd, mid, buf) < target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Stream candles in [fromMs, toMs] from the binary cache. */
export async function* streamCached(
  tf: "H1" | "H4" | "M1",
  fromMs?: number,
  toMs?: number
): AsyncGenerator<Candle> {
  const meta = cacheStatus(tf);
  if (meta.status !== "READY") throw new Error(`${tf} cache is not READY (${meta.status})`);
  const fd = fs.openSync(binPath(tf), "r");
  try {
    const count = meta.candleCount;
    let i = fromMs !== undefined ? lowerBound(fd, count, fromMs) : 0;
    const CHUNK = 8192;
    const buf = Buffer.allocUnsafe(RECORD_SIZE * CHUNK);
    while (i < count) {
      const n = Math.min(CHUNK, count - i);
      fs.readSync(fd, buf, 0, n * RECORD_SIZE, i * RECORD_SIZE);
      for (let k = 0; k < n; k++) {
        const off = k * RECORD_SIZE;
        const ts = buf.readDoubleLE(off);
        if (toMs !== undefined && ts > toMs) return;
        yield {
          timestamp: ts,
          open: buf.readDoubleLE(off + 8),
          high: buf.readDoubleLE(off + 16),
          low: buf.readDoubleLE(off + 24),
          close: buf.readDoubleLE(off + 32),
        };
      }
      i += n;
    }
  } finally {
    fs.closeSync(fd);
  }
}

export async function loadCached(
  tf: "H1" | "H4" | "M1",
  fromMs?: number,
  toMs?: number
): Promise<Candle[]> {
  const out: Candle[] = [];
  for await (const c of streamCached(tf, fromMs, toMs)) out.push(c);
  return out;
}

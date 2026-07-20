import fs from "fs";
import readline from "readline";
import type { Candle } from "@/backtest/types";

export type ParseStats = {
  totalRows: number;
  emptyRows: number;
  invalidRows: number;
  duplicateRows: number;
  outOfOrderRows: number;
};

export function emptyStats(): ParseStats {
  return {
    totalRows: 0,
    emptyRows: 0,
    invalidRows: 0,
    duplicateRows: 0,
    outOfOrderRows: 0,
  };
}

/**
 * Parse "2010.01.04" + "00:00:00" (MT5) or ISO-like "2010-01-04 00:00" into
 * epoch ms, treating the data timezone as UTC.
 */
export function parseTimestamp(date: string, time?: string): number {
  const d = date.trim().replace(/\./g, "-").replace("T", " ");
  const t = (time ?? "").trim();
  const full = t ? `${d} ${t}` : d;
  const m = full.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[ ](\d{2}):(\d{2})(?::(\d{2}))?)?$/
  );
  if (!m) return NaN;
  return Date.UTC(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    Number(m[4] ?? 0),
    Number(m[5] ?? 0),
    Number(m[6] ?? 0)
  );
}

type ColumnMap = {
  sep: string;
  date: number;
  time: number; // -1 when timestamp is a single column
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number; // -1 when absent
};

export function detectColumns(headerLine: string): ColumnMap | null {
  const sep = headerLine.includes("\t")
    ? "\t"
    : headerLine.includes(";")
      ? ";"
      : ",";
  const cols = headerLine
    .replace(/^﻿/, "")
    .split(sep)
    .map((c) => c.trim().replace(/[<>]/g, "").toLowerCase());
  const idx = (...names: string[]) =>
    cols.findIndex((c) => names.includes(c));
  const date = idx("date", "timestamp", "datetime", "time");
  const time = idx("time");
  const open = idx("open");
  const high = idx("high");
  const low = idx("low");
  const close = idx("close");
  const volume = idx("tickvol", "volume", "vol");
  if (date < 0 || open < 0 || high < 0 || low < 0 || close < 0) return null;
  return {
    sep,
    date,
    time: time === date ? -1 : time,
    open,
    high,
    low,
    close,
    volume,
  };
}

export function parseRow(line: string, map: ColumnMap): Candle | null {
  const parts = line.split(map.sep);
  const date = parts[map.date];
  if (date === undefined) return null;
  const timestamp = parseTimestamp(
    date,
    map.time >= 0 ? parts[map.time] : undefined
  );
  const open = Number(parts[map.open]);
  const high = Number(parts[map.high]);
  const low = Number(parts[map.low]);
  const close = Number(parts[map.close]);
  if (
    !Number.isFinite(timestamp) ||
    !Number.isFinite(open) ||
    !Number.isFinite(high) ||
    !Number.isFinite(low) ||
    !Number.isFinite(close)
  )
    return null;
  const candle: Candle = { timestamp, open, high, low, close };
  if (map.volume >= 0) {
    const v = Number(parts[map.volume]);
    if (Number.isFinite(v)) candle.volume = v;
  }
  return candle;
}

export function isValidOHLC(c: Candle): boolean {
  return (
    c.high >= c.open &&
    c.high >= c.close &&
    c.high >= c.low &&
    c.low <= c.open &&
    c.low <= c.close
  );
}

/**
 * Stream candles from a CSV file in ascending time order, skipping empty,
 * invalid, duplicate and out-of-order rows (counted in `stats`).
 * Optional [fromMs, toMs] filter (inclusive).
 */
export async function* streamCandles(
  filePath: string,
  stats: ParseStats,
  fromMs?: number,
  toMs?: number
): AsyncGenerator<Candle> {
  const rl = readline.createInterface({
    input: fs.createReadStream(filePath, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });
  let map: ColumnMap | null = null;
  let lastTs = -Infinity;
  for await (const line of rl) {
    if (!map) {
      map = detectColumns(line);
      if (!map) throw new Error(`Unrecognized CSV header in ${filePath}`);
      continue;
    }
    stats.totalRows++;
    if (line.trim() === "") {
      stats.emptyRows++;
      continue;
    }
    const c = parseRow(line, map);
    if (!c || !isValidOHLC(c)) {
      stats.invalidRows++;
      continue;
    }
    if (c.timestamp === lastTs) {
      stats.duplicateRows++;
      continue;
    }
    if (c.timestamp < lastTs) {
      stats.outOfOrderRows++;
      continue;
    }
    lastTs = c.timestamp;
    if (fromMs !== undefined && c.timestamp < fromMs) continue;
    if (toMs !== undefined && c.timestamp > toMs) return;
    yield c;
  }
}

export async function loadCandles(
  filePath: string,
  fromMs?: number,
  toMs?: number
): Promise<{ candles: Candle[]; stats: ParseStats }> {
  const stats = emptyStats();
  const candles: Candle[] = [];
  for await (const c of streamCandles(filePath, stats, fromMs, toMs)) {
    candles.push(c);
  }
  return { candles, stats };
}

import { config } from "dotenv";
config({ path: ".env.local" });
import type { AnyBulkWriteOperation } from "mongodb";
import { getMongoClient, getMongoDb, ensureMongoIndexes } from "../src/lib/mongodb";
import { findDataFile } from "../src/data/validator";
import { emptyStats, streamCandles } from "../src/data/csv-loader";
import type { CloudTimeframe, DataSyncState } from "../src/lib/cloud-types";

const args = new Set(process.argv.slice(2));
const value = (name: string) => process.argv.find((x) => x.startsWith(`${name}=`))?.split("=").slice(1).join("=");
const requested = value("--timeframe");
const timeframes: CloudTimeframe[] = requested ? [requested as CloudTimeframe] : ["M1", "H1", "H4"];
if (timeframes.some((x) => !["M1", "H1", "H4"].includes(x))) throw new Error("--timeframe must be M1, H1, or H4");
const from = new Date(value("--from") || "2022-01-01T00:00:00.000Z");
if (!Number.isFinite(from.getTime())) throw new Error("--from must be a valid date");
const dryRun = args.has("--dry-run");
const resume = args.has("--resume");
const batchSize = Number(value("--batch-size") || "2000");
if (!Number.isInteger(batchSize) || batchSize < 1) throw new Error("--batch-size must be a positive integer");
if (!dryRun && !process.env.MONGODB_URI) throw new Error("MONGODB_URI is required for cloud import");

const overlapMs: Record<CloudTimeframe, number> = { M1: 60_000, H1: 3_600_000, H4: 14_400_000 };
const safeDate = (value: unknown): Date | null => value ? new Date(value as string | number | Date) : null;

async function importTimeframe(timeframe: CloudTimeframe) {
  const sourceFile = findDataFile(timeframe);
  if (!sourceFile) throw new Error(`Source ${timeframe} CSV not found`);
  const stats = emptyStats();
  const db = dryRun ? null : await getMongoDb();
  const state = db?.collection<DataSyncState>("data_sync_state");
  if (db) await ensureMongoIndexes();
  const previous = resume ? await state?.findOne({ symbol: "XAUUSD", timeframe }) : null;
  const checkpoint = safeDate(previous?.lastProcessedTimestamp ?? previous?.lastClosedTimestamp);
  const start = checkpoint ? new Date(Math.max(from.getTime(), checkpoint.getTime() - overlapMs[timeframe])) : from;
  const importStartedAt = new Date();
  let batch: AnyBulkWriteOperation[] = [];
  let scanned = 0;
  let eligible = 0;
  let skipped = 0;
  let skippedBeforeRange = 0;
  let inserted = 0;
  let updated = 0;
  let first: Date | null = null;
  let last: Date | null = null;
  const started = Date.now();

  const persistCheckpoint = async (lastProcessedTimestamp: Date | null) => {
    if (!db || !state) return;
    await state.updateOne({ symbol: "XAUUSD", timeframe }, { $set: {
      symbol: "XAUUSD", timeframe, source: "MT5_CSV", importFrom: from, status: "SYNCING",
      lastProcessedTimestamp, firstTimestamp: safeDate(previous?.firstTimestamp) || first,
      lastClosedTimestamp: lastProcessedTimestamp, candleCount: await db.collection("candles").countDocuments({ symbol: "XAUUSD", timeframe }),
      scannedCount: scanned, insertedCount: inserted, updatedCount: updated,
      invalidCount: stats.invalidRows, skippedCount: skippedBeforeRange + skipped,
      lastAttemptAt: importStartedAt, lastSuccessAt: safeDate(previous?.lastSuccessAt), lastError: null,
    } }, { upsert: true });
  };

  if (db && state) await state.updateOne({ symbol: "XAUUSD", timeframe }, { $set: { source: "MT5_CSV", importFrom: from, status: "SYNCING", lastAttemptAt: importStartedAt, lastError: null } }, { upsert: true });
  try {
    for await (const candle of streamCandles(sourceFile, stats)) {
      scanned++;
      if (candle.timestamp < from.getTime()) { skippedBeforeRange++; continue; }
      if (candle.timestamp < start.getTime()) { skipped++; continue; }
      const timestamp = new Date(candle.timestamp);
      first ??= timestamp; last = timestamp; eligible++;
      batch.push({ updateOne: { filter: { symbol: "XAUUSD", timeframe, timestamp }, update: { $set: {
        open: candle.open, high: candle.high, low: candle.low, close: candle.close, volume: candle.volume ?? null,
        source: "MT5_CSV", isClosed: true, updatedAt: new Date(),
      }, $setOnInsert: { symbol: "XAUUSD", timeframe, timestamp, createdAt: new Date() } }, upsert: true } });
      if (batch.length >= batchSize && db) {
        const result = await db.collection("candles").bulkWrite(batch, { ordered: false });
        inserted += result.upsertedCount; updated += result.modifiedCount; batch = [];
        await persistCheckpoint(last);
        console.log(`Timeframe: ${timeframe}\nScanned: ${scanned}\nEligible: ${eligible}\nInserted: ${inserted}\nUpdated: ${updated}\nInvalid: ${stats.invalidRows}\nSkipped before ${from.toISOString().slice(0, 10)}: ${skippedBeforeRange}\nLast timestamp: ${last.toISOString()}\nElapsed: ${((Date.now() - started) / 1000).toFixed(1)}s`);
      }
    }
    if (db && batch.length) { const result = await db.collection("candles").bulkWrite(batch, { ordered: false }); inserted += result.upsertedCount; updated += result.modifiedCount; batch = []; await persistCheckpoint(last); }
    const candleCount = db ? await db.collection("candles").countDocuments({ symbol: "XAUUSD", timeframe }) : eligible;
    if (db && state) await state.updateOne({ symbol: "XAUUSD", timeframe }, { $set: {
      status: "READY", firstTimestamp: safeDate(previous?.firstTimestamp) || first, lastClosedTimestamp: last || safeDate(previous?.lastClosedTimestamp),
      lastProcessedTimestamp: last || safeDate(previous?.lastProcessedTimestamp), candleCount, scannedCount: scanned,
      insertedCount: inserted, updatedCount: updated, invalidCount: stats.invalidRows, skippedCount: skippedBeforeRange + skipped,
      lastAttemptAt: importStartedAt, lastSuccessAt: new Date(), lastError: null,
    } });
    const batchCount = Math.ceil(eligible / batchSize);
    console.log(JSON.stringify({ timeframe, source: sourceFile, from: from.toISOString(), scanned, eligible, skippedBeforeRange, skipped, invalid: stats.invalidRows, inserted, updated, candleCount, estimatedBatches: batchCount, dryRun }, null, 2));
  } catch (error) {
    if (db && state) await state.updateOne({ symbol: "XAUUSD", timeframe }, { $set: { status: "FAILED", lastError: error instanceof Error ? error.name : "IMPORT_FAILED", lastAttemptAt: importStartedAt, scannedCount: scanned, insertedCount: inserted, updatedCount: updated, invalidCount: stats.invalidRows, skippedCount: skippedBeforeRange + skipped } }, { upsert: true });
    throw error;
  }
}

async function main() {
  try { for (const timeframe of timeframes) await importTimeframe(timeframe); }
  finally {
    if (!dryRun && process.env.MONGODB_URI) {
      try { await (await getMongoClient()).close(); } catch { /* preserve the original import result */ }
    }
  }
}
main().catch((error) => { console.error(error instanceof Error ? error.message : "IMPORT_FAILED"); process.exitCode = 1; });

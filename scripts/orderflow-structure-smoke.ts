import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import fs from "fs";
import path from "path";
import { getMongoClient } from "../src/lib/mongodb";
import { MongoCandleRepository } from "../src/data/mongo-candle-repository";
import { DEFAULT_STRUCTURE_CONFIG, calculateDailyLevels, calculateProxyVwap, calculateWeeklyLevels, buildSessionMetrics, sessionOverlap, sourceClockToAbsolute, analyzeMarketEvents } from "../src/strategies/orderflow_confluence_v1/structure";

const START = new Date("2024-01-01T00:00:00.000Z");
const END = new Date("2024-01-08T00:00:00.000Z");
const WARMUP = new Date("2023-12-17T00:00:00.000Z");
const REPORT = path.join(process.cwd(), "reports", "orderflow-structure-smoke-2024-01-01.json");
const now = () => Date.now();
const duration = (start: number) => Date.now() - start;
const writeReport = (value: unknown) => { fs.mkdirSync(path.dirname(REPORT), { recursive: true }); fs.writeFileSync(REPORT, JSON.stringify(value, null, 2)); };
const withTimeout = async <T>(promise: Promise<T>, ms: number, message: string): Promise<T> => await Promise.race([promise, new Promise<T>((_, reject) => setTimeout(() => reject(new Error(message)), ms))]);
const validate = (candles: { timestamp: number }[], start: number, end: number) => ({ outsideRange: candles.filter((x) => x.timestamp < start || x.timestamp >= end).length, ascending: candles.every((x, i) => i === 0 || x.timestamp > candles[i - 1].timestamp) });

async function main() {
  const totalStart = now(); let client: Awaited<ReturnType<typeof getMongoClient>> | null = null; let connectMs = 0; let m1Ms = 0; let d1Ms = 0; let calculationMs = 0;
  try {
    const connectStart = now();
    try { client = await withTimeout(getMongoClient(), 30000, "MONGODB_CONNECTION_TIMEOUT"); } catch (error) { throw new Error(`MONGODB_CONNECTION_FAILED: ${error instanceof Error ? error.message : String(error)}`); }
    connectMs = duration(connectStart);
    const repo = new MongoCandleRepository();
    const m1Start = now(); let m1;
    try { m1 = await withTimeout(repo.getCandlesExclusive("XAUUSD", "M1", START, END), 45000, "M1_QUERY_TIMEOUT"); } catch (error) { throw new Error(`M1_QUERY_FAILED: ${error instanceof Error ? error.message : String(error)}`); }
    m1Ms = duration(m1Start);
    const d1Start = now(); let d1;
    try { d1 = await withTimeout(repo.getCandlesExclusive("XAUUSD", "D1", WARMUP, END), 45000, "D1_QUERY_TIMEOUT"); } catch (error) { throw new Error(`D1_QUERY_FAILED: ${error instanceof Error ? error.message : String(error)}`); }
    d1Ms = duration(d1Start);
    if (!m1.length) throw new Error("M1_DATA_EMPTY");
    if (!d1.length) throw new Error("D1_DATA_EMPTY");
    const calcStart = now(); const cfg = DEFAULT_STRUCTURE_CONFIG;
    const evaluationTime = sourceClockToAbsolute(m1[m1.length - 1].timestamp, cfg.brokerTimeZone, cfg.sourceClockEncoding);
    const sessions = Object.fromEntries((Object.keys(cfg.sessions) as Array<keyof typeof cfg.sessions>).map((name) => [name, buildSessionMetrics(m1, name, cfg, evaluationTime)]));
    const daily = calculateDailyLevels(d1, cfg).filter((x) => x.date >= "2024-01-01");
    const weekly = calculateWeeklyLevels(d1, cfg).filter((x) => x.weekStart >= "2023-12-17");
    const vwap = calculateProxyVwap(m1, cfg); const vwapByDay = Object.values(vwap.reduce<Record<string, typeof vwap>>((a, x) => { const day = new Date(x.timestamp).toISOString().slice(0, 10); (a[day] ??= []).push(x); return a; }, {})).map((x) => x[x.length - 1]);
    const pdh = daily[0]?.previousDayHigh; const pdl = daily[0]?.previousDayLow;
    const levels = [pdh?.price ? { levelType: "PREVIOUS_DAY_HIGH" as const, price: pdh.price, direction: "RESISTANCE" as const } : null, pdl?.price ? { levelType: "PREVIOUS_DAY_LOW" as const, price: pdl.price, direction: "SUPPORT" as const } : null].filter((x): x is NonNullable<typeof x> => Boolean(x));
    const eventAnalysis = analyzeMarketEvents(m1, levels.map((x) => ({ ...x, knownAt: x.levelType === "PREVIOUS_DAY_HIGH" ? pdh?.knownAt : pdl?.knownAt })), cfg, evaluationTime); const events = eventAnalysis.events; const dates = Array.from(new Set(d1.filter((x) => x.timestamp >= START.getTime() && x.timestamp < END.getTime()).map((x) => new Date(sourceClockToAbsolute(x.timestamp, cfg.brokerTimeZone, cfg.sourceClockEncoding)).toISOString().slice(0, 10))));
    const knownAtViolations = [...daily.flatMap((x) => [x.previousDayHigh, x.previousDayLow, x.dailyOpen]), ...weekly.flatMap((x) => [x.previousWeekHigh, x.previousWeekLow, x.weeklyOpen])].filter((x): x is NonNullable<typeof x> => Boolean(x)).filter((x) => x.knownAt > evaluationTime).length;
    calculationMs = duration(calcStart);
    const currentWeek = weekly.find((x) => x.weekStart === "2023-12-31") ?? weekly[weekly.length - 1];
    const result = { status: "COMPLETED", period: { startInclusive: START.toISOString(), endExclusive: END.toISOString(), d1WarmupStart: WARMUP.toISOString() }, candleCounts: { M1: m1.length, D1: d1.filter((x) => x.timestamp >= START.getTime() && x.timestamp < END.getTime()).length, D1WithWarmup: d1.length }, timestamps: { M1: { first: new Date(m1[0].timestamp).toISOString(), last: new Date(m1[m1.length - 1].timestamp).toISOString() }, D1: { first: new Date(d1[0].timestamp).toISOString(), last: new Date(d1[d1.length - 1].timestamp).toISOString() } }, validation: { m1: validate(m1, START.getTime(), END.getTime()), d1: validate(d1.filter((x) => x.timestamp >= WARMUP.getTime() && x.timestamp < END.getTime()), WARMUP.getTime(), END.getTime()), knownAtViolations, tradesOpened: 0 }, brokerTimeZone: cfg.brokerTimeZone, offsetsByDate: dates.map((date) => ({ date, timezone: cfg.brokerTimeZone })), sessions, overlap: sessionOverlap(cfg.sessions.LONDON, cfg.sessions.NEW_YORK, evaluationTime), levels: { PDH: pdh ?? null, PDL: pdl ?? null, dailyOpen: daily[0]?.dailyOpen ?? null, PWH: currentWeek?.previousWeekHigh ?? null, PWL: currentWeek?.previousWeekLow ?? null, weeklyOpen: currentWeek?.weeklyOpen ?? null }, proxy_vwap: vwapByDay, eventCounts: { sweep: events.filter((x) => x.type.endsWith("SWEEP")).length, sweepSupport: eventAnalysis.sweepSupport, sweepResistance: eventAnalysis.sweepResistance, reclaim: events.filter((x) => x.type.endsWith("RECLAIM")).length, reclaimWithParentSweep: eventAnalysis.reclaimWithParentSweep, breakoutUnique: events.filter((x) => x.type.endsWith("BREAKOUT") && x.type !== "FAILED_BREAKOUT").length, rejection: events.filter((x) => x.type === "REJECTION").length, failedBreakout: events.filter((x) => x.type === "FAILED_BREAKOUT").length, failedBreakoutWithParent: eventAnalysis.failedBreakoutWithParent, duplicateEventRejected: eventAnalysis.duplicateRejected, expiredEvent: eventAnalysis.expiredEvents, invariantViolations: eventAnalysis.invariantViolations }, volumeWarnings: vwap.at(-1)?.warningCount ?? 0, durationsMs: { connect: connectMs, m1Query: m1Ms, d1Query: d1Ms, calculation: calculationMs, total: duration(totalStart) } };
    writeReport(result); console.log(JSON.stringify({ status: result.status, candleCounts: result.candleCounts, durationsMs: result.durationsMs, eventCounts: result.eventCounts, tradesOpened: 0 }));
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error); const report = { status: "FAILED", period: { startInclusive: START.toISOString(), endExclusive: END.toISOString(), d1WarmupStart: WARMUP.toISOString() }, candleCounts: { M1: 0, D1: 0 }, validation: { tradesOpened: 0 }, durationsMs: { connect: connectMs, m1Query: m1Ms, d1Query: d1Ms, calculation: calculationMs, total: duration(totalStart) }, error: detail }; writeReport(report); console.error(detail); process.exitCode = 1;
  } finally { if (client) await client.close().catch(() => undefined); }
}
main();

import { config } from "dotenv";
config({ path: ".env.local" });
import fs from "node:fs/promises";
import { getMongoDb } from "../src/lib/mongodb";

const keep = ["backtest026XAU", "backtest035XAU"];
const collections = ["backtest_jobs", "backtest_runs", "backtest_trades", "backtest_equity"] as const;

async function main() {
  const db = await getMongoDb();
  const runs = await db.collection("backtest_runs").find({}, { projection: { _id: 0, runId: 1, strategyId: 1, status: 1 } }).toArray();
  const ids = Array.from(new Set(runs.map((x) => String(x.runId)).filter(Boolean)));
  const details = await Promise.all(runs.map(async (run) => ({
    runId: run.runId,
    strategyId: run.strategyId ?? null,
    status: run.status ?? "COMPLETED",
    trades: await db.collection("backtest_trades").countDocuments({ runId: run.runId }),
    equity: await db.collection("backtest_equity").countDocuments({ runId: run.runId }),
  })));
  const deletedRunIds = ids.filter((id) => !keep.includes(id));
  const manifest = { runIdsBeforeCleanup: ids, runs: details, retainedRunIds: keep, deletedRunIds, timestamp: new Date().toISOString() };
  await fs.mkdir("reports", { recursive: true });
  await fs.writeFile("reports/cleanup-backtest-manifest.json", JSON.stringify(manifest, null, 2) + "\n", "utf8");
  const deleted: Record<string, number> = {};
  for (const name of collections) deleted[name] = (await db.collection(name).deleteMany({ runId: { $nin: keep } })).deletedCount;
  const remaining = Object.fromEntries(await Promise.all(collections.map(async (name) => [name, await db.collection(name).distinct("runId")]))) as Record<string, string[]>;
  const orphan = Object.fromEntries(await Promise.all(["backtest_trades", "backtest_equity"].map(async (name) => [name, await db.collection(name).countDocuments({ runId: { $nin: keep } })]))) as Record<string, number>;
  console.log(JSON.stringify({ before: ids.length, after: remaining.backtest_runs.length, deletedRunIds, deleted, remaining, orphan }, null, 2));
  if (Object.values(orphan).some((n) => n !== 0) || remaining.backtest_runs.some((id) => !keep.includes(id))) process.exitCode = 1;
}
main().catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });

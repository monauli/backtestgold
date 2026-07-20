import { config } from "dotenv";
config({ path: ".env.local" });
import { spawnSync } from "node:child_process";
import * as readline from "node:readline/promises";

const args = new Set(process.argv.slice(2));
const value = (name: string) => process.argv.find((x) => x.startsWith(`${name}=`))?.split("=").slice(1).join("=");
const dryRun = args.has("--dry-run"); const from = value("--from") || "2022-01-01"; const batch = value("--batch-size") || "2000";
async function main() {
  const frames = ["H4", "H1"];
  if (!args.has("--skip-m1")) {
    if (dryRun) frames.push("M1");
    else { const rl = readline.createInterface({ input: process.stdin, output: process.stdout }); const answer = await rl.question("Import M1 (large file, may take time)? Type YES to continue: "); rl.close(); if (answer.trim() === "YES") frames.push("M1"); else console.log("M1 skipped"); }
  }
  for (const timeframe of frames) { const result = spawnSync(process.execPath, ["node_modules/tsx/dist/cli.mjs", "scripts/import-xau-csv-to-mongodb.ts", `--timeframe=${timeframe}`, `--from=${from}`, `--batch-size=${batch}`, ...(dryRun ? ["--dry-run"] : ["--resume"])], { stdio: "inherit" }); if (result.status !== 0) process.exit(result.status || 1); }
}
main().catch((error) => { console.error(error instanceof Error ? error.message : "seed failed"); process.exitCode = 1; });

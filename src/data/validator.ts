import fs from "fs";
import path from "path";

export const DATA_DIR = path.join(process.cwd(), "data manual");
const PATTERNS: Record<"H1" | "H4" | "M1", RegExp> = {
  H1: /^XAUUSD_H1(?:_|\.|$)/i,
  H4: /^XAUUSD_H4(?:_|\.|$)/i,
  M1: /^XAUUSD_M1(?:_|\.|$)/i,
};

export function listSourceFiles(): string[] {
  try { return fs.readdirSync(DATA_DIR, { withFileTypes: true }).filter((x) => x.isFile() && x.name.toLowerCase().endsWith(".csv")).map((x) => x.name); }
  catch { return []; }
}
export function findDataCandidates(timeframe: "H1" | "H4" | "M1"): string[] {
  return listSourceFiles().filter((name) => PATTERNS[timeframe].test(name));
}
export function findDataFile(timeframe: "H1" | "H4" | "M1"): string | null {
  const candidates = findDataCandidates(timeframe);
  if (!candidates.length) return null;
  candidates.sort((a, b) => {
    const exact = (name: string) => name.toUpperCase() === `XAUUSD_${timeframe}.CSV` ? 0 : name.toUpperCase() === `XAUUSD_${timeframe}_2010_2026.CSV` ? 1 : 2;
    const score = exact(a) - exact(b); if (score) return score;
    return fs.statSync(path.join(DATA_DIR, b)).mtimeMs - fs.statSync(path.join(DATA_DIR, a)).mtimeMs;
  });
  return path.join(DATA_DIR, candidates[0]);
}
export function sourceNotFoundMessage(timeframe: "H1" | "H4" | "M1"): string {
  const found = listSourceFiles();
  return `${timeframe} source CSV not found in:\n${DATA_DIR}\n\nFound CSV files:\n${found.length ? found.map((x) => `- ${x}`).join("\n") : "- (none)"}`;
}

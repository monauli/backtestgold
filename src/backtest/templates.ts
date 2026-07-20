import fs from "fs";
import path from "path";
import type { BacktestTemplate } from "./types";

const FILE = path.join(process.cwd(), "data-cache", "templates.json");
function ensureDir() { fs.mkdirSync(path.dirname(FILE), { recursive: true }); }
function seed(): BacktestTemplate[] {
  const now = new Date().toISOString();
  return [{ strategyId: "xau_h4_breakout", templateId: "template-breakout-rr-1-2", templateName: "Breakout RR 1:2", config: { strategyId: "xau_h4_breakout", breakoutPips: 100, stopLossPips: 200, takeProfitPips: 400, lot: 0.4, initialBalance: 10000 }, breakoutPips: 100, stopLossPips: 200, takeProfitPips: 400, lot: 0.4, initialBalance: 10000, createdAt: now, updatedAt: now } as BacktestTemplate];
}
export function readTemplates(strategyId?: string): BacktestTemplate[] {
  try { const items = (JSON.parse(fs.readFileSync(FILE, "utf8")) as BacktestTemplate[]).map((x) => ({ ...x, strategyId: x.strategyId ?? "xau_h4_breakout", config: x.config ?? { strategyId: x.strategyId ?? "xau_h4_breakout", breakoutPips: x.breakoutPips, stopLossPips: x.stopLossPips, takeProfitPips: x.takeProfitPips, lot: x.lot, initialBalance: x.initialBalance } })); return strategyId ? items.filter((x) => x.strategyId === strategyId) : items; }
  catch { const initial = seed(); ensureDir(); fs.writeFileSync(FILE, JSON.stringify(initial, null, 2)); return initial; }
}
function write(items: BacktestTemplate[]) { ensureDir(); fs.writeFileSync(FILE, JSON.stringify(items, null, 2)); }
function validate(input: Partial<BacktestTemplate>) {
  if (!input.templateName?.trim()) throw new Error("Template name is required");
  for (const [label, value] of [["Breakout", input.breakoutPips], ["Stop Loss", input.stopLossPips], ["Take Profit", input.takeProfitPips], ["Lot", input.lot], ["Initial balance", input.initialBalance]] as const) if (!(typeof value === "number" && Number.isFinite(value) && value > 0)) throw new Error(`${label} must be positive`);
}
export function createTemplate(input: Omit<BacktestTemplate, "templateId" | "createdAt" | "updatedAt">) {
  validate(input); const items = readTemplates(); if (items.some((x) => x.templateName.toLowerCase() === input.templateName!.trim().toLowerCase())) throw new Error("Template name already exists");
  const now = new Date().toISOString(); const item = { ...input, strategyId: input.strategyId ?? "xau_h4_breakout", templateName: input.templateName.trim(), templateId: `template-${Date.now()}`, createdAt: now, updatedAt: now }; items.push(item); write(items); return item;
}
export function updateTemplate(id: string, input: Partial<BacktestTemplate>) {
  const items = readTemplates(); const index = items.findIndex((x) => x.templateId === id); if (index < 0) throw new Error("Template not found");
  const next = { ...items[index], ...input, templateId: id, updatedAt: new Date().toISOString() }; validate(next);
  if (items.some((x, i) => i !== index && x.templateName.toLowerCase() === next.templateName.trim().toLowerCase())) throw new Error("Template name already exists");
  next.templateName = next.templateName.trim(); items[index] = next; write(items); return next;
}
export function deleteTemplate(id: string) { const items = readTemplates(); if (!items.some((x) => x.templateId === id)) throw new Error("Template not found"); write(items.filter((x) => x.templateId !== id)); }

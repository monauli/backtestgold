import { getMongoDb, ensureMongoIndexes } from "./mongodb";
import type { BacktestTemplate } from "@/backtest/types";
export class MongoTemplateRepository {
  async list(strategyId?: string) { const query = strategyId ? { strategyId } : {}; return (await (await getMongoDb()).collection<BacktestTemplate>("backtest_templates").find(query).sort({ updatedAt: -1 }).toArray()).map((x) => ({ ...x, _id: undefined })); }
  async create(item: BacktestTemplate) { await ensureMongoIndexes(); await (await getMongoDb()).collection<BacktestTemplate>("backtest_templates").insertOne(item); return item; }
  async update(strategyId: string, templateId: string, item: Partial<BacktestTemplate>) { const result = await (await getMongoDb()).collection("backtest_templates").findOneAndUpdate({ strategyId, templateId }, { $set: { ...item, updatedAt: new Date() } }, { returnDocument: "after" }); if (!result) throw new Error("Template not found"); return result; }
  async delete(strategyId: string, templateId: string) { await (await getMongoDb()).collection("backtest_templates").deleteOne({ strategyId, templateId }); }
}

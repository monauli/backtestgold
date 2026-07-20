import type { CandleRepository } from "./repository";
import { LocalCandleRepository } from "./local-candle-repository";
import { MongoCandleRepository } from "./mongo-candle-repository";

export type DataStorageMode = "LOCAL" | "MONGODB";
export function getDataStorageMode(): DataStorageMode { return process.env.DATA_STORAGE_MODE === "MONGODB" ? "MONGODB" : "LOCAL"; }
export function getCandleRepository(): CandleRepository { return getDataStorageMode() === "MONGODB" ? new MongoCandleRepository() : new LocalCandleRepository(); }

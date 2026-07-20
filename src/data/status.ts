import type { CacheMeta } from "@/backtest/types";
import { cacheStatus } from "./cache";

export type DataStatus = {
  generatedAt: string;
  h4: CacheMeta;
  m1: CacheMeta;
  h1: CacheMeta;
};

export function datasetPeriod(status: DataStatus) {
  const first = Math.max(Date.parse(status.h4.firstDate ?? ""), Date.parse(status.m1.firstDate ?? ""));
  const last = Math.min(Date.parse(status.h4.lastDate ?? ""), Date.parse(status.m1.lastDate ?? ""));
  const firstDate = new Date(first).toISOString().slice(0, 10);
  const lastDate = new Date(last).toISOString().slice(0, 10);
  const defaultStart = firstDate > "2020-01-01" ? firstDate : "2020-01-01";
  return { datasetStartDate: firstDate, datasetEndDate: lastDate, defaultStartDate: defaultStart, defaultEndDate: lastDate };
}

/** Reads cache metadata only — never touches the raw CSVs. */
export function getDataStatus(): DataStatus {
  return {
    generatedAt: new Date().toISOString(),
    h4: cacheStatus("H4"),
    m1: cacheStatus("M1"),
    h1: cacheStatus("H1"),
  };
}

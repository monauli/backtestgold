import { describe, expect, it } from "vitest";
import path from "path";
import { DATA_DIR, findDataCandidates, findDataFile, listSourceFiles, sourceNotFoundMessage } from "@/data/validator";
import { datasetPeriod } from "@/data/status";

describe("data source finder", () => {
  it("finds the active H4 and M1 sources in a folder with spaces", () => {
    expect(DATA_DIR).toBe(path.join(process.cwd(), "data manual"));
    expect(findDataFile("H4")).toMatch(/XAUUSD_H4_2010_2026\.csv$/i);
    expect(findDataFile("M1")).toMatch(/XAUUSD_M1_2010_2026\.csv$/i);
  });
  it("does not match M15, M30, or Monthly as M1", () => {
    const names = findDataCandidates("M1").map((x) => x.toUpperCase());
    expect(names.some((x) => x.includes("M15") || x.includes("M30") || x.includes("MONTHLY"))).toBe(false);
  });
  it("provides a useful missing-source message", () => {
    const message = sourceNotFoundMessage("H4");
    expect(message).toContain(DATA_DIR); expect(message).toContain("Found CSV files:"); expect(message).toContain(listSourceFiles()[0]);
  });
  it("uses 2020 as default start unless data begins later", () => {
    const result = datasetPeriod({ generatedAt: "", h4: { firstDate: "2010-01-04T00:00:00.000Z", lastDate: "2026-06-16T16:00:00.000Z" } as never, m1: { firstDate: "2010-01-04T01:05:00.000Z", lastDate: "2026-06-16T17:44:00.000Z" } as never, h1: {} as never });
    expect(result.defaultStartDate).toBe("2020-01-01"); expect(result.defaultEndDate).toBe("2026-06-16");
    const later = datasetPeriod({ generatedAt: "", h4: { firstDate: "2022-01-01T00:00:00.000Z", lastDate: "2023-01-02T00:00:00.000Z" } as never, m1: { firstDate: "2022-01-01T00:01:00.000Z", lastDate: "2023-01-01T23:00:00.000Z" } as never, h1: {} as never });
    expect(later.defaultStartDate).toBe("2022-01-01");
  });
});

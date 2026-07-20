import { describe, it, expect } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import {
  detectColumns,
  parseRow,
  parseTimestamp,
  isValidOHLC,
  loadCandles,
} from "@/data/csv-loader";

const MT5_HEADER = "<DATE>\t<TIME>\t<OPEN>\t<HIGH>\t<LOW>\t<CLOSE>\t<TICKVOL>\t<VOL>\t<SPREAD>";

describe("CSV normalization", () => {
  it("parses MT5 tab-delimited format", () => {
    const map = detectColumns(MT5_HEADER)!;
    expect(map.sep).toBe("\t");
    const row = parseRow("2010.01.04\t00:05:00\t1094.61\t1099.15\t1093.08\t1097.87\t9623\t0\t0", map);
    expect(row).toEqual({
      timestamp: Date.UTC(2010, 0, 4, 0, 5, 0),
      open: 1094.61,
      high: 1099.15,
      low: 1093.08,
      close: 1097.87,
      volume: 9623,
    });
  });

  it("parses generic comma format with single timestamp column", () => {
    const map = detectColumns("timestamp,open,high,low,close,volume")!;
    expect(map.sep).toBe(",");
    expect(map.time).toBe(-1);
    const row = parseRow("2024-01-02 10:00,1,2,0.5,1.5,100", map);
    expect(row?.timestamp).toBe(Date.UTC(2024, 0, 2, 10, 0, 0));
    expect(row?.close).toBe(1.5);
  });

  it("parseTimestamp handles both dot and dash dates", () => {
    expect(parseTimestamp("2024.03.05", "12:34:56")).toBe(Date.UTC(2024, 2, 5, 12, 34, 56));
    expect(parseTimestamp("2024-03-05")).toBe(Date.UTC(2024, 2, 5));
    expect(parseTimestamp("garbage")).toBeNaN();
  });

  it("skips empty, invalid, duplicate and out-of-order rows while streaming", async () => {
    const file = path.join(os.tmpdir(), `bt-fixture-${Date.now()}.csv`);
    fs.writeFileSync(
      file,
      [
        MT5_HEADER,
        "2024.01.02\t00:00:00\t10\t12\t9\t11\t1\t0\t0",
        "",
        "2024.01.02\t00:01:00\tabc\t12\t9\t11\t1\t0\t0", // invalid number
        "2024.01.02\t00:02:00\t10\t9\t11\t10\t1\t0\t0", // invalid OHLC (high<low)
        "2024.01.02\t00:03:00\t10\t12\t9\t11\t1\t0\t0",
        "2024.01.02\t00:03:00\t10\t12\t9\t11\t1\t0\t0", // duplicate
        "2024.01.02\t00:01:00\t10\t12\t9\t11\t1\t0\t0", // out of order
      ].join("\n")
    );
    const { candles, stats } = await loadCandles(file);
    fs.unlinkSync(file);
    expect(candles).toHaveLength(2);
    expect(stats.emptyRows).toBe(1);
    expect(stats.invalidRows).toBe(2);
    expect(stats.duplicateRows).toBe(1);
    expect(stats.outOfOrderRows).toBe(1);
  });
});

describe("OHLC validation", () => {
  it("accepts valid candles and rejects invalid ones", () => {
    expect(isValidOHLC({ timestamp: 0, open: 10, high: 12, low: 9, close: 11 })).toBe(true);
    expect(isValidOHLC({ timestamp: 0, open: 10, high: 9.5, low: 9, close: 9.2 })).toBe(false); // high < open
    expect(isValidOHLC({ timestamp: 0, open: 10, high: 12, low: 10.5, close: 11 })).toBe(false); // low > open
    expect(isValidOHLC({ timestamp: 0, open: 10, high: 12, low: 9, close: 12.5 })).toBe(false); // close > high
  });
});

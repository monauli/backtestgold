import { describe, expect, it, vi } from "vitest";
import { CLOUD_COLLECTIONS } from "@/lib/mongodb-schema";

describe("MongoDB cloud contracts", () => {
  it("defines the required collections", () => {
    expect(CLOUD_COLLECTIONS).toEqual(expect.arrayContaining([
      "candles", "data_sync_state", "backtest_runs", "backtest_trades", "backtest_equity",
      "backtest_jobs", "backtest_templates", "backtest_counters", "strategy_registry", "data_sync_locks",
    ]));
  });

  it("classifies missing URI without exposing configuration", async () => {
    vi.stubEnv("MONGODB_URI", "");
    const { classifyMongoError } = await import("@/lib/mongodb");
    const error = classifyMongoError(new Error("mongodb+srv://user:super-secret-password@example.mongodb.net"));
    expect(error).toBe("MONGODB_URI_NOT_CONFIGURED");
    expect(JSON.stringify({ errorCode: error })).not.toContain("super-secret-password");
    vi.unstubAllEnvs();
  });
});

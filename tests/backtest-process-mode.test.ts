import { afterEach, describe, expect, it, vi } from "vitest";
import { getBacktestProcessMode } from "@/lib/backtest-process-mode";

describe("backtest process mode", () => {
  afterEach(() => { vi.unstubAllEnvs(); });
  it("honors explicit INLINE mode", () => { vi.stubEnv("BACKTEST_PROCESS_MODE", "INLINE"); expect(getBacktestProcessMode()).toBe("INLINE"); });
  it("honors explicit CRON mode", () => { vi.stubEnv("BACKTEST_PROCESS_MODE", "CRON"); expect(getBacktestProcessMode()).toBe("CRON"); });
  it("defaults away from INLINE in production", () => { vi.stubEnv("BACKTEST_PROCESS_MODE", ""); vi.stubEnv("NODE_ENV", "production"); expect(getBacktestProcessMode()).toBe("CRON"); });
});

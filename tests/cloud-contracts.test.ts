import { describe, expect, it, afterEach } from "vitest";
import { getDataStorageMode, getCandleRepository } from "@/data/repository-factory";
import { LocalCandleRepository } from "@/data/local-candle-repository";
import { MongoCandleRepository } from "@/data/mongo-candle-repository";
import { getXauMarketDataProvider } from "@/lib/xau-provider";
import { GET as health } from "@/app/api/health/route";

const originalMode = process.env.DATA_STORAGE_MODE;
const originalUri = process.env.MONGODB_URI;
afterEach(() => { if (originalMode === undefined) delete process.env.DATA_STORAGE_MODE; else process.env.DATA_STORAGE_MODE = originalMode; if (originalUri === undefined) delete process.env.MONGODB_URI; else process.env.MONGODB_URI = originalUri; });

describe("cloud architecture contracts", () => {
  it("selects LOCAL by default and MONGODB explicitly", () => {
    delete process.env.DATA_STORAGE_MODE; expect(getDataStorageMode()).toBe("LOCAL"); expect(getCandleRepository()).toBeInstanceOf(LocalCandleRepository);
    process.env.DATA_STORAGE_MODE = "MONGODB"; expect(getDataStorageMode()).toBe("MONGODB"); expect(getCandleRepository()).toBeInstanceOf(MongoCandleRepository);
  });
  it("does not invent a provider", () => { delete process.env.XAU_DATA_PROVIDER; expect(getXauMarketDataProvider()).toBeNull(); });
  it("health never exposes secrets and reports local mode", async () => { delete process.env.DATA_STORAGE_MODE; process.env.MONGODB_URI = ""; const response = await health(); const body = await response.json(); expect(body.dataStorageMode).toBe("LOCAL"); expect(JSON.stringify(body)).not.toContain("MONGODB_URI"); expect(JSON.stringify(body)).not.toContain("CRON_SECRET"); });
});

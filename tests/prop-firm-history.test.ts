import { describe, expect, it } from "vitest";
import { isSimulationHistoryRecord, simulationHistoryFilter } from "@/lib/prop-firm-simulator/history";

describe("Prop Firm Simulation History", () => {
  it("never includes a saved final method", () => {
    const records = [
      { simulationId: "pfs-030", final: false },
      { simulationId: "pfs-032" },
      { simulationId: "final-0.30", methodName: "Breakout H4 — The5ers Final", final: true },
    ];

    expect(records.filter(isSimulationHistoryRecord).map((record) => record.simulationId)).toEqual(["pfs-030", "pfs-032"]);
    expect(simulationHistoryFilter).toEqual({ final: { $ne: true } });
  });
});

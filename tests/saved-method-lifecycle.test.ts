import { describe, expect, it } from "vitest";
import { FINAL_METHOD, SAVED_METHODS } from "@/config/saved-methods";
import { activeMethods, archiveMethod, archivedMethods, canArchiveMethod, defaultMethodId, finalMethodInvariant, isRunnableMethod, restoreMethod, selectedLotForMethod } from "@/lib/prop-firm-simulator/method-lifecycle";

describe("saved method lifecycle", () => {
  it("defaults the selector to the only active FINAL method", () => {
    expect(activeMethods(SAVED_METHODS).map((method) => method.id)).toEqual([FINAL_METHOD.id]);
    expect(defaultMethodId(SAVED_METHODS)).toBe(FINAL_METHOD.id);
    expect(finalMethodInvariant(SAVED_METHODS)).toBe(true);
  });

  it("keeps legacy methods archived with their source configuration unchanged", () => {
    const archived = archivedMethods(SAVED_METHODS);
    expect(archived).toHaveLength(4);
    expect(archived.every((method) => method.status === "ARCHIVED" && method.archivedAt && method.archivedReason)).toBe(true);
    expect(archived.map((method) => [method.sourceRunId, method.breakoutPips, method.stopLossPips, method.takeProfitPips])).toEqual([
      ["backtest026XAU", 25, 200, 400], ["backtest026XAU", 25, 200, 400], ["backtest026XAU", 25, 200, 400], ["backtest026XAU", 25, 200, 400],
    ]);
  });

  it("shows archived methods only when requested and prevents them from running", () => {
    const legacy = archivedMethods(SAVED_METHODS)[0];
    expect(isRunnableMethod(legacy)).toBe(false);
    expect(archivedMethods(SAVED_METHODS).map((method) => method.name)).toContain("Breakout H4 — Prop Firm Baseline");
  });

  it("never archives FINAL and can restore an archived method without changing FINAL", () => {
    expect(() => archiveMethod(SAVED_METHODS, FINAL_METHOD.id)).toThrow("Final method tidak dapat diarsipkan.");
    const legacy = archivedMethods(SAVED_METHODS)[0];
    const restored = restoreMethod(SAVED_METHODS, legacy.id);
    expect(restored.find((method) => method.id === legacy.id)?.status).toBe("ACTIVE");
    expect(restored.find((method) => method.id === FINAL_METHOD.id)).toEqual(FINAL_METHOD);
    expect(finalMethodInvariant(restored)).toBe(true);
  });

  it("does not alter simulation-history metadata", () => {
    expect(SAVED_METHODS.every((method) => !Object.prototype.hasOwnProperty.call(method, "simulationId"))).toBe(true);
  });

  it("locks FINAL to lot 0.30 and disables its archive action", () => {
    expect(selectedLotForMethod(FINAL_METHOD, "0.35")).toBe("0.30");
    expect(selectedLotForMethod(FINAL_METHOD, "0.32")).toBe("0.30");
    expect(canArchiveMethod(FINAL_METHOD)).toBe(false);
  });

  it("keeps lot choices available for restored non-FINAL methods", () => {
    const restored = restoreMethod(SAVED_METHODS, "breakout-h4-balanced");
    const method = restored.find((item) => item.id === "breakout-h4-balanced")!;
    expect(selectedLotForMethod(method, "0.35")).toBe("0.35");
    expect(canArchiveMethod(method)).toBe(true);
  });
});

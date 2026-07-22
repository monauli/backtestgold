import { describe, expect, it, vi } from "vitest";
import { FINAL_METHOD } from "@/config/saved-methods";
import { saveFinalMethod } from "@/lib/prop-firm-simulator/final-method";

const payload = { methodId: FINAL_METHOD.id, lot: 0.30, startDate: "2022-01-03", endDate: "2026-06-16" };
const finalMethod = { simulationId: "final-0.3", methodId: FINAL_METHOD.id, methodName: FINAL_METHOD.name, selectedLot: 0.30 };

describe("final method save workflow", () => {
  it("returns a saved final method and resets the button state", async () => {
    const states: boolean[] = [];
    const result = await saveFinalMethod(payload, (saving) => states.push(saving), vi.fn().mockResolvedValue(new Response(JSON.stringify({ finalMethod, method: FINAL_METHOD, duplicate: false }), { status: 200 })));
    expect(result.duplicate).toBe(false);
    expect(result.method.badge).toBe("FINAL");
    expect(states).toEqual([true, false]);
  });

  it("treats a duplicate final method as a successful saved state", async () => {
    const result = await saveFinalMethod(payload, vi.fn(), vi.fn().mockResolvedValue(new Response(JSON.stringify({ finalMethod, method: FINAL_METHOD, duplicate: true }), { status: 200 })));
    expect(result.duplicate).toBe(true);
    expect(result.finalMethod.methodId).toBe(FINAL_METHOD.id);
  });

  it("surfaces an API error and still resets the button state", async () => {
    const states: boolean[] = [];
    await expect(saveFinalMethod(payload, (saving) => states.push(saving), vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "Database unavailable" }), { status: 500 })))).rejects.toThrow("Database unavailable");
    expect(states).toEqual([true, false]);
  });

  it("uses the configured final method so it can be added to the dropdown", () => {
    expect(FINAL_METHOD).toMatchObject({ name: "Breakout H4 — The5ers Final", lot: 0.30, sourceRunId: "backtest026XAU", breakoutPips: 25, stopLossPips: 200, takeProfitPips: 400, badge: "FINAL" });
  });
});

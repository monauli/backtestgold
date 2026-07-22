import { describe, expect, it } from "vitest";
import { isActiveWindowEntry, jakartaEntryHour } from "@/lib/prop-firm-simulator/active-window";
describe("Jakarta active entry window", () => {
  it("handles active/sleep bounds", () => {
    expect(isActiveWindowEntry(Date.parse("2024-01-01T18:59:00Z"))).toBe(true); // 23:59 WIB
    expect(isActiveWindowEntry(Date.parse("2024-01-01T19:00:00Z"))).toBe(false); // 00:00 WIB
    expect(isActiveWindowEntry(Date.parse("2024-01-02T01:59:00Z"))).toBe(false); // 06:59 WIB
    expect(isActiveWindowEntry(Date.parse("2024-01-02T02:00:00Z"))).toBe(true); // 07:00 WIB
  });
  it("uses Helsinki DST conversion rather than a fixed offset", () => {
    expect(jakartaEntryHour(Date.parse("2024-01-01T02:00:00Z"))).toBe(7);
    expect(jakartaEntryHour(Date.parse("2024-07-01T03:00:00Z"))).toBe(7);
  });
});

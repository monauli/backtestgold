import { MONEY_EPSILON, money } from "@/lib/prop-firm-simulator";

export type RecommendationStatus = "LAYAK" | "DITOLAK";

export const HISTORY_NUMERIC_FIELDS = [
  "selectedLot", "rollingSimulations", "step1Pass", "step1Fail", "step1PassRate",
  "step2ConditionalPass", "step2ConditionalPassRate", "fullPass", "fullFail",
  "fullChallengePassRate", "medianStep1Days", "medianStep2Days", "medianProfitableDays",
  "worstDailyLoss", "maximumDrawdown", "maximumTotalDrawdown", "dailyLossBuffer",
  "totalLossBuffer", "dailyLossBreaches", "maximumLossBreaches",
];

export function safeNumber(value: number | null | undefined) { return typeof value === "number" && Number.isFinite(value) ? value : null; }
export function safeFixed(value: number | null | undefined, digits = 2) { const normalized = safeNumber(value); return normalized === null ? "-" : normalized.toFixed(digits); }
export function normalizeNumericFields<T extends Record<string, unknown>>(item: T, fields: string[]) { const copy = { ...item } as T; for (const field of fields) (copy as Record<string, unknown>)[field] = safeNumber((copy as Record<string, unknown>)[field] as number | null | undefined); return copy; }

export function recommendationForHistory(item: Record<string, unknown>) {
  const numberField = (name: string) => safeNumber(item[name] as number | null | undefined);
  const fullRate = numberField("fullChallengePassRate");
  const worstDailyLoss = numberField("worstDailyLoss");
  const maximumDrawdown = numberField("maximumDrawdown") ?? numberField("maximumTotalDrawdown");
  const dailyLossBreaches = numberField("dailyLossBreaches");
  const maximumLossBreaches = numberField("maximumLossBreaches");
  const reasons: string[] = [];
  if (fullRate === null || fullRate < 95 - MONEY_EPSILON) reasons.push("Full challenge pass rate di bawah 95%.");
  if (worstDailyLoss === null || money(worstDailyLoss) < -300 - MONEY_EPSILON) reasons.push("Worst daily loss melewati -$300.");
  if (maximumDrawdown === null || money(maximumDrawdown) > 700 + MONEY_EPSILON) reasons.push("Maximum drawdown melebihi $700.");
  if (dailyLossBreaches === null || dailyLossBreaches !== 0) reasons.push("Ada daily-loss breach.");
  if (maximumLossBreaches === null || maximumLossBreaches !== 0) reasons.push("Ada maximum-loss breach.");
  return {
    recommendationStatus: (reasons.length ? "DITOLAK" : "LAYAK") as RecommendationStatus,
    recommendationReason: reasons.length ? reasons.join(" ") : "Memenuhi seluruh batas rekomendasi.",
  };
}

export function normalizeHistoryRecord(item: Record<string, unknown>) {
  const normalized = normalizeNumericFields(item, HISTORY_NUMERIC_FIELDS);
  for (const field of ["worstDailyLoss", "maximumDrawdown", "maximumTotalDrawdown", "dailyLossBuffer", "totalLossBuffer"]) {
    const value = safeNumber(normalized[field] as number | null | undefined);
    normalized[field] = value === null ? null : money(value);
  }
  const maximumDrawdown = safeNumber(normalized.maximumDrawdown as number | null | undefined) ?? safeNumber(normalized.maximumTotalDrawdown as number | null | undefined);
  const calculated = recommendationForHistory({ ...normalized, maximumDrawdown });
  const status = normalized.recommendationStatus === "LAYAK" || normalized.recommendationStatus === "DITOLAK"
    ? normalized.recommendationStatus
    : calculated.recommendationStatus;
  const reason = typeof normalized.recommendationReason === "string" && normalized.recommendationReason.trim()
    ? normalized.recommendationReason
    : calculated.recommendationReason;
  return { ...normalized, maximumDrawdown, recommendationStatus: status, recommendationReason: reason };
}

import type { SavedMethod } from "@/config/saved-methods";

export type FinalMethodSavePayload = {
  methodId: string;
  lot: number;
  startDate: string;
  endDate: string;
};

export type FinalMethodSaveResult = {
  finalMethod: { simulationId: string; methodId: string; methodName: string; selectedLot: number };
  method: SavedMethod;
  duplicate: boolean;
};

export async function saveFinalMethod(
  payload: FinalMethodSavePayload,
  setSaving: (saving: boolean) => void,
  fetchImpl: typeof fetch = fetch,
): Promise<FinalMethodSaveResult> {
  setSaving(true);
  try {
    const response = await fetchImpl("/api/prop-firm/final-method", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({})) as Partial<FinalMethodSaveResult> & { error?: string };
    if (!response.ok) throw new Error(data.error || "Final method gagal disimpan.");
    if (!data.finalMethod || !data.method || typeof data.duplicate !== "boolean") {
      throw new Error("Respons penyimpanan final method tidak valid.");
    }
    return data as FinalMethodSaveResult;
  } finally {
    setSaving(false);
  }
}

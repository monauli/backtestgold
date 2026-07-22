import { NextResponse } from "next/server";
import { FINAL_METHOD } from "@/config/saved-methods";
import { getMongoDb } from "@/lib/mongodb";

const sourceStart = "2022-01-03";
const sourceEnd = "2026-06-16";

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    if (body.methodId !== FINAL_METHOD.id || body.lot !== FINAL_METHOD.lot || body.startDate !== sourceStart || body.endDate !== sourceEnd) {
      return NextResponse.json({ error: "Data final method tidak valid." }, { status: 400 });
    }

    const filter = {
      methodId: FINAL_METHOD.id,
      selectedLot: FINAL_METHOD.lot,
      sourceRunId: FINAL_METHOD.sourceRunId,
      startDate: sourceStart,
      endDate: sourceEnd,
      final: true,
    };
    const db = await getMongoDb();
    const existing = await db.collection("prop_firm_simulations").findOne(filter);
    if (existing) {
      return NextResponse.json({ finalMethod: existing, method: FINAL_METHOD, duplicate: true });
    }

    const doc = {
      ...filter,
      simulationId: `final-${FINAL_METHOD.lot}-${sourceStart}-${sourceEnd}`,
      methodName: FINAL_METHOD.name,
      badge: "FINAL",
      breakoutPips: FINAL_METHOD.breakoutPips,
      stopLossPips: FINAL_METHOD.stopLossPips,
      takeProfitPips: FINAL_METHOD.takeProfitPips,
      propFirmProgramName: "The5ers High Stakes Classic $10K",
      createdAt: new Date(),
      simulatorVersion: "1.2.0",
    };
    await db.collection("prop_firm_simulations").insertOne(doc);
    return NextResponse.json({ finalMethod: doc, method: FINAL_METHOD, duplicate: false });
  } catch (error) {
    console.error("Failed to save final prop-firm method", error);
    return NextResponse.json({ error: "Final method gagal disimpan. Coba lagi." }, { status: 500 });
  }
}

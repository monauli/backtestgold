import { NextResponse } from "next/server";
import { getMongoDb } from "@/lib/mongodb";
import { normalizeHistoryRecord } from "@/lib/prop-firm-simulator/format";
export async function GET(_request: Request, { params }: { params: { simulationId: string } }) { const doc = await (await getMongoDb()).collection("prop_firm_simulations").findOne({ simulationId: params.simulationId }, { projection: { _id: 0 } }); return doc ? NextResponse.json(normalizeHistoryRecord(doc as Record<string, unknown>)) : NextResponse.json({ error: "Simulation not found" }, { status: 404 }); }
export async function DELETE(_request: Request, { params }: { params: { simulationId: string } }) { const result = await (await getMongoDb()).collection("prop_firm_simulations").deleteOne({ simulationId: params.simulationId }); return result.deletedCount ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Simulation not found" }, { status: 404 }); }

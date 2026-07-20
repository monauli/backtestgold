import { NextResponse } from "next/server";
import { deleteTemplate, updateTemplate } from "@/backtest/templates";
import { getDataStorageMode } from "@/data/repository-factory";
import { MongoTemplateRepository } from "@/lib/cloud-template-repository";

export const dynamic = "force-dynamic";
export async function PUT(request: Request, { params }: { params: { templateId: string } }) {
  try { if (getDataStorageMode() === "MONGODB") return NextResponse.json(await new MongoTemplateRepository().update(new URL(request.url).searchParams.get("strategyId") ?? "xau_h4_breakout", params.templateId, await request.json())); return NextResponse.json(updateTemplate(params.templateId, await request.json())); }
  catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 }); }
}
export async function DELETE(_request: Request, { params }: { params: { templateId: string } }) {
  try { if (getDataStorageMode() === "MONGODB") await new MongoTemplateRepository().delete(new URL(_request.url).searchParams.get("strategyId") ?? "xau_h4_breakout", params.templateId); else deleteTemplate(params.templateId); return NextResponse.json({ ok: true }); }
  catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 }); }
}

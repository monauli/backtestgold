import { NextResponse } from "next/server";
import { createTemplate, readTemplates } from "@/backtest/templates";
import { getDataStorageMode } from "@/data/repository-factory";
import { MongoTemplateRepository } from "@/lib/cloud-template-repository";

export const dynamic = "force-dynamic";
export async function GET(request: Request) { const strategyId = new URL(request.url).searchParams.get("strategyId") ?? undefined; if (getDataStorageMode() === "MONGODB") return NextResponse.json(await new MongoTemplateRepository().list(strategyId)); return NextResponse.json(readTemplates(strategyId)); }
export async function POST(request: Request) {
  try { const input = await request.json(); if (getDataStorageMode() === "MONGODB") return NextResponse.json(await new MongoTemplateRepository().create(input), { status: 201 }); return NextResponse.json(createTemplate(input), { status: 201 }); }
  catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 409 }); }
}

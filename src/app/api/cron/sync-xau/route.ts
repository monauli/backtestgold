import { NextResponse } from "next/server";
import { syncTimeframe } from "@/lib/sync-service";
import type { CloudTimeframe } from "@/lib/cloud-types";
export const dynamic = "force-dynamic";
const allowed = new Set<CloudTimeframe>(["M1", "H1", "H4"]);
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET; if (!secret) return NextResponse.json({ status: "CRON_SECRET_NOT_CONFIGURED" }, { status: 500 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const body = await request.json().catch(() => ({})); const values = body.timeframes ?? ["M1", "H1", "H4"]; if (!Array.isArray(values) || values.some((x) => !allowed.has(x))) return NextResponse.json({ error: "INVALID_TIMEFRAMES" }, { status: 400 });
  const results = []; for (const timeframe of values as CloudTimeframe[]) results.push(await syncTimeframe(timeframe));
  const status = results.some((x) => x.status === "FAILED") ? "PARTIAL_FAILURE" : results.some((x) => x.status === "PROVIDER_NOT_CONFIGURED") ? "PROVIDER_NOT_CONFIGURED" : "COMPLETED";
  return NextResponse.json({ status, symbol: "XAUUSD", results });
}

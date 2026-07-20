import { NextResponse } from "next/server";
import { buildCache } from "@/data/cache";
import { DATA_DIR, findDataFile, sourceNotFoundMessage } from "@/data/validator";
import { getDataStorageMode } from "@/data/repository-factory";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Build/rebuild the local binary index for H4 and M1 from the source CSVs. */
export async function POST(request: Request) {
  try {
    if (getDataStorageMode() === "MONGODB") return NextResponse.json({ error: "LOCAL_DATA_INDEX_DISABLED_IN_MONGODB_MODE" }, { status: 400 });
    const body = await request.json().catch(() => ({}));
    const requested = Array.isArray(body.timeframes) ? body.timeframes : ["H4", "M1"];
    if (requested.length === 1 && requested[0] === "H1") {
      const source = findDataFile("H1"); if (!source) throw new Error(sourceNotFoundMessage("H1"));
      const h1 = await buildCache("H1");
      return NextResponse.json({ h1, dataDirectory: DATA_DIR, sources: { h1: source } });
    }
    const h4Source = findDataFile("H4"); const m1Source = findDataFile("M1");
    if (!h4Source) throw new Error(sourceNotFoundMessage("H4"));
    if (!m1Source) throw new Error(sourceNotFoundMessage("M1"));
    const h4 = await buildCache("H4");
    const m1 = await buildCache("M1");
    return NextResponse.json({ h4, m1, dataDirectory: DATA_DIR, sources: { h4: h4Source, m1: m1Source } });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}

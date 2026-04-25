import { parseSearchQuery } from "@/lib/parseSearchQuery";
import { searchAll } from "@/lib/searchTires";
import { parseTireIndexQueryParams } from "@/lib/tyreIndexFilter";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const seasonP = req.nextUrl.searchParams.get("season");
  const loadP = req.nextUrl.searchParams.get("load");
  const speedP = req.nextUrl.searchParams.get("speed");

  const parsed = parseSearchQuery(q, seasonP);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error, offers: [], errors: [] }, { status: 400 });
  }

  const indexParsed = parseTireIndexQueryParams(loadP, speedP);
  if ("error" in indexParsed) {
    return NextResponse.json({ error: indexParsed.error, offers: [], errors: [] }, { status: 400 });
  }

  const indexFilter =
    indexParsed.load == null && indexParsed.speed == null
      ? undefined
      : { load: indexParsed.load, speed: indexParsed.speed };

  const { season, ...size } = parsed;
  const { offers, errors } = await searchAll(size, season, indexFilter);
  return NextResponse.json({ offers, errors, size: parsed });
}

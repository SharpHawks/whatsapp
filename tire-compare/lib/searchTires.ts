import { fetchText } from "./fetchText";
import { parseMmkHtml } from "./parsers/mmk";
import { parseR1ApiBody } from "./parsers/r1";
import { parseRiepugarazaHtml } from "./parsers/riepugaraza";
import { titleMatchesTireIndex } from "./tyreIndexFilter";
import type { ParsedSize, TireOffer } from "./types";

export type SourceError = { source: string; message: string };

export type SearchResult = {
  offers: TireOffer[];
  errors: SourceError[];
};

export type TireIndexFilter = { load?: string; speed?: string };

function r1SeasonParam(season: "summer" | "winter"): "1" | "2" {
  return season === "summer" ? "1" : "2";
}

function r1Diameter(d: string): string {
  return d.replace(/c$/i, "");
}

/**
 * 9-digit query …01 = summer, …02 = winter. MMK/RG category URLs can list both; drop rows whose shop season is known to disagree.
 * R1 is already the correct list for the requested season; keep all.
 */
function offerMatchesQuerySeason(o: TireOffer, querySeason: "summer" | "winter"): boolean {
  if (o.source === "r1riepas.lv") {
    return true;
  }
  if (o.season === null || o.season === "all_season") {
    return true;
  }
  return o.season === querySeason;
}

export async function searchAll(
  size: ParsedSize,
  season: "summer" | "winter",
  indexFilter?: TireIndexFilter,
): Promise<SearchResult> {
  const slug = size.slug;
  const mmkUrl = buildMmkUrl("https://mmkriepas.lv", slug);
  const rgUrl = buildMmkUrl("https://www.riepugaraza.lv", slug);
  const r1Url = new URL(`https://r1riepas.lv/api/tires/auto/${r1SeasonParam(season)}`);
  r1Url.searchParams.set("d1", size.width);
  r1Url.searchParams.set("d2", size.profile);
  r1Url.searchParams.set("d3", r1Diameter(size.diameter));
  r1Url.searchParams.set("top", "show");
  r1Url.searchParams.set("table_type", "list");

  const errors: SourceError[] = [];
  const rgUrls = [rgUrl, `${rgUrl}?lapa=2`, `${rgUrl}?lapa=3`];

  const [mmkR, rgR1, rgR2, rgR3, r1R] = await Promise.allSettled([
    fetchText(mmkUrl),
    fetchText(rgUrls[0]),
    fetchText(rgUrls[1]),
    fetchText(rgUrls[2]),
    fetchText(r1Url.toString()),
  ]);

  const offers: TireOffer[] = [];

  if (mmkR.status === "fulfilled") {
    try {
      offers.push(...parseMmkHtml(mmkR.value, size));
    } catch (e) {
      errors.push({ source: "mmkriepas.lv", message: e instanceof Error ? e.message : "parse" });
    }
  } else {
    errors.push({ source: "mmkriepas.lv", message: String(mmkR.reason) });
  }

  const rgParts = [rgR1, rgR2, rgR3] as const;
  const rgSeen = new Set<string>();
  for (const rgR of rgParts) {
    if (rgR.status !== "fulfilled") {
      continue;
    }
    try {
      for (const o of parseRiepugarazaHtml(rgR.value, size)) {
        if (rgSeen.has(o.id)) continue;
        rgSeen.add(o.id);
        offers.push(o);
      }
    } catch (e) {
      errors.push({ source: "riepugaraza.lv", message: e instanceof Error ? e.message : "parse" });
      break;
    }
  }
  if (rgParts.every((r) => r.status === "rejected")) {
    const first = rgParts[0];
    errors.push({
      source: "riepugaraza.lv",
      message: first.status === "rejected" ? String(first.reason) : "unknown",
    });
  }

  if (r1R.status === "fulfilled") {
    try {
      offers.push(...parseR1ApiBody(r1R.value, season));
    } catch (e) {
      errors.push({ source: "r1riepas.lv", message: e instanceof Error ? e.message : "parse" });
    }
  } else {
    errors.push({ source: "r1riepas.lv", message: String(r1R.reason) });
  }

  let matched = offers.filter((o) => offerMatchesQuerySeason(o, season));
  if (indexFilter && (indexFilter.load != null || indexFilter.speed != null)) {
    matched = matched.filter((o) =>
      titleMatchesTireIndex(o.title, indexFilter.load, indexFilter.speed),
    );
  }
  matched.sort((a, b) => a.price - b.price);
  return { offers: matched, errors };
}

function buildMmkUrl(host: string, slug: string): string {
  return `${host}/riepas/${slug}/`;
}

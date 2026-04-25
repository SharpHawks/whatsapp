import * as cheerio from "cheerio";
import type { ParsedSize, ShopTireSeason, TireOffer } from "../types";

const BASE = "https://www.riepugaraza.lv";

/** Path segment: /vasaras-riepas/, /ziemas-riepas/, vissezonas, … */
function seasonFromRgUrl(href: string): ShopTireSeason {
  const u = href.toLowerCase();
  if (u.includes("vasaras")) return "summer";
  if (u.includes("ziemas")) return "winter";
  if (u.includes("vissezon")) return "all_season";
  return null;
}

function sizeLineMatches(nameBig: string, size: ParsedSize): boolean {
  const n = nameBig.replace(/\s+/g, " ").trim().toLowerCase();
  const w = size.width;
  const p = size.profile;
  const d = size.diameter.replace("c", "").replace(".", ".");
  if (n.includes(`${w}/${p}`) && n.includes(`r${d.split(".")[0]}`)) {
    return true;
  }
  return n.includes(`${w}/${p}`) && n.includes(size.diameter.replace("c", ""));
}

export function parseRiepugarazaHtml(html: string, size: ParsedSize): TireOffer[] {
  const $ = cheerio.load(html);
  const out: TireOffer[] = [];
  let i = 0;
  $("li.item").each((_, li) => {
    const $li = $(li);
    const nameBig = $li.find("h3.name_big").first().text().trim();
    if (nameBig && !sizeLineMatches(nameBig, size)) {
      return;
    }
    const name = $li.find("h3.name").first().text().trim();
    const title = [nameBig, name].filter(Boolean).join(" — ");
    const activeText = $li.find(".active_price").first().text();
    const oldText = $li.find(".old_price").first().text();
    const mA = activeText.replace(/\s/g, "").match(/([\d,.]+)/);
    const mO = oldText.replace(/\s/g, "").match(/([\d,.]+)/);
    const price = mA ? parseFloat(mA[1].replace(",", ".")) : NaN;
    const listRaw = mO ? parseFloat(mO[1].replace(",", ".")) : NaN;
    const listPrice = Number.isFinite(listRaw) && listRaw > price ? listRaw : null;
    const href = $li.find("a[href]").first().attr("href") ?? "";
    if (!title || !Number.isFinite(price) || !href) return;
    const url = href.startsWith("http") ? href : `${BASE}${href}`;
    i += 1;
    out.push({
      id: `rg-${$li.attr("data-id") ?? i}`,
      source: "riepugaraza.lv",
      title,
      price,
      listPrice,
      url,
      sizeLine: nameBig || null,
      season: seasonFromRgUrl(url),
    });
  });
  return out;
}

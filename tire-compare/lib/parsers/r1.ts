import * as cheerio from "cheerio";
import type { ShopTireSeason, TireOffer } from "../types";

function parseEuroText(text: string): number {
  const t = text.replace(/\s/g, "");
  const m = t.match(/([\d,.]+)/);
  if (!m) return NaN;
  return parseFloat(m[1].replace(",", "."));
}

/**
 * @param listSeason R1 list is for one season only (API path /1 or /2).
 */
export function parseR1ApiBody(text: string, listSeason: "summer" | "winter"): TireOffer[] {
  const r1Season: ShopTireSeason = listSeason;
  let html = text;
  const trimmed = text.trim();
  if (trimmed.startsWith('"')) {
    try {
      html = JSON.parse(text) as string;
    } catch {
      return [];
    }
  }
  const $ = cheerio.load(html);
  const out: TireOffer[] = [];
  let i = 0;
  $("tr.tire-table-row").each((_, tr) => {
    const $tr = $(tr);
    const $link = $tr.find("a.tire-table-link").first();
    const title = $link.find(".table-link-title").first().text().trim();
    const href = $link.attr("href") ?? "";
    const sale = parseEuroText($tr.find("td.sale-price").first().text());
    const store = parseEuroText($tr.find("td.store-price").first().text());
    if (!title || !href || !Number.isFinite(sale)) return;
    const price = sale;
    const listPrice = Number.isFinite(store) && store > price ? store : null;
    i += 1;
    out.push({
      id: `r1-${$tr.find('input[name="product_ids[]"]').val() ?? i}`,
      source: "r1riepas.lv",
      title,
      price,
      listPrice,
      url: href.startsWith("http") ? href : `https://r1riepas.lv${href}`,
      sizeLine: null,
      season: r1Season,
    });
  });
  return out;
}

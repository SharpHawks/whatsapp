import * as cheerio from "cheerio";
import type { ParsedSize, ShopTireSeason, TireOffer } from "../types";

type GtmProduct = {
  item_name?: string;
  price?: number;
  productlink?: string;
  /** Latvian category, e.g. "Vasaras riepas", "Ziemas riepas" */
  item_category?: string;
};

function seasonFromMmkCategory(raw: string | undefined): ShopTireSeason {
  if (!raw) return null;
  const c = raw.toLowerCase();
  if (c.includes("vasaras")) return "summer";
  if (c.includes("ziemas")) return "winter";
  if (c.includes("vissezon")) return "all_season";
  return null;
}

/** Same idea as r1: strip spaces, take first decimal number */
function parseEuroText(text: string): number {
  const t = text.replace(/\s/g, "");
  const m = t.match(/([\d,.]+)/);
  if (!m) return NaN;
  return parseFloat(m[1].replace(",", "."));
}

export function parseMmkHtml(html: string, size: ParsedSize): TireOffer[] {
  const $ = cheerio.load(html);
  const out: TireOffer[] = [];
  let i = 0;
  $('span.gtm4wp_productdata[data-gtm4wp_product_data]').each((_, el) => {
    const raw = $(el).attr("data-gtm4wp_product_data");
    if (!raw) return;
    let data: GtmProduct;
    try {
      data = JSON.parse(raw) as GtmProduct;
    } catch {
      return;
    }
    const title = (data.item_name ?? "").trim();
    const gtmPrice = typeof data.price === "number" ? data.price : NaN;
    const link = (data.productlink ?? "").trim();
    if (!title || !link || !Number.isFinite(gtmPrice)) return;

    const $li = $(el).closest("li.product");
    const delText = $li.find("del").first().text();
    const insText = $li.find("ins").first().text();
    const listFromDel = delText ? parseEuroText(delText) : NaN;
    const saleFromIns = insText ? parseEuroText(insText) : NaN;
    const price = Number.isFinite(saleFromIns) ? saleFromIns : gtmPrice;
    const listPrice = Number.isFinite(listFromDel) && listFromDel > price ? listFromDel : null;
    i += 1;
    out.push({
      id: `mmk-${i}-${data.item_name?.slice(0, 24) ?? i}`,
      source: "mmkriepas.lv",
      title,
      price,
      listPrice,
      url: link,
      sizeLine: `${size.width}/${size.profile} R${size.diameter.toUpperCase()}`,
      season: seasonFromMmkCategory(data.item_category),
    });
  });
  return out;
}

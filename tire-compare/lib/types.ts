/**
 * Season as stated by the shop (category, URL, or the R1 list we queried). null = unknown.
 */
export type ShopTireSeason = "summer" | "winter" | "all_season" | null;

export type TireOffer = {
  id: string;
  source: "mmkriepas.lv" | "riepugaraza.lv" | "r1riepas.lv";
  title: string;
  /** Promotional / current price (EUR) */
  price: number;
  listPrice: number | null;
  url: string;
  sizeLine: string | null;
  season: ShopTireSeason;
};

export type ParsedSize = {
  width: string;
  profile: string;
  diameter: string;
  /** e.g. 205-55-r16 or 205-55-r16c */
  slug: string;
};

export type ParsedSizeWithSeason = ParsedSize & {
  season: "summer" | "winter";
};

/** One physical size from catalog (union of shop URL slugs + R1 dimensions) */
export type TireSizeEntry = {
  width: string;
  profile: string;
  diameter: string;
  slug: string;
};

import { parseTireSizeInput } from "./parseSize";
import { digitCodeToParsedSize } from "./tireSizeCode";
import type { ParsedSizeWithSeason } from "./types";

/**
 * 9-digit code (…01/02) or text size, optionally with `season` when using text.
 */
export function parseSearchQuery(
  raw: string,
  seasonParam: string | null | undefined,
): ParsedSizeWithSeason | { error: string } {
  const t = raw.trim().replace(/\s+/g, "");
  if (!t) {
    return { error: "Выберите размер или введите код" };
  }
  if (/^\d{9}$/.test(t)) {
    return digitCodeToParsedSize(t);
  }
  const p = parseTireSizeInput(t);
  if ("error" in p) {
    return p;
  }
  const season = seasonParam === "winter" || seasonParam === "02" ? "winter" : "summer";
  return { ...p, season };
}

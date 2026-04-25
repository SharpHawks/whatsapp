import type { ParsedSize } from "./types";

/**
 * Parse size from "205/55/16", "205/55R16", "205-55-16" into URL-friendly parts.
 */
export function parseTireSizeInput(raw: string): ParsedSize | { error: string } {
  const t = raw.trim().replace(/\s+/g, "");
  if (!t) {
    return { error: "Введите размер, напр. 205/55/16" };
  }
  // 205/55/16, 205/55R16, 205/55R16C
  let m = t.match(/^(\d{2,3})\/(\d{2,3})\/r?([0-9]{1,2}(?:\.[0-9])?[cC]?)$/i);
  if (m) {
    const w = m[1];
    const p = m[2];
    const d = m[3].toLowerCase();
    return { width: w, profile: p, diameter: d, slug: makeSlug(w, p, d) };
  }
  m = t.match(/^(\d{2,3})\/(\d{2,3})[rR]([0-9]{1,2}\.?[0-9]?[cC]?)$/i);
  if (m) {
    const w = m[1];
    const p = m[2];
    const d = m[3].toLowerCase();
    return { width: w, profile: p, diameter: d, slug: makeSlug(w, p, d) };
  }
  return { error: "Формат: 205/55/16 или 205/55R16" };
}

/** Path segment, e.g. 205-55-r16, 195-50-r17-5, 205-55-r16c */
export function makeSlug(width: string, profile: string, diameter: string): string {
  const d = diameter.toLowerCase();
  if (d.includes(".")) {
    return `${width}-${profile}-r${d.replace(".", "-")}`;
  }
  return `${width}-${profile}-r${d}`;
}

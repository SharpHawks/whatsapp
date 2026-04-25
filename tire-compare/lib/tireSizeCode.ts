import type { ParsedSizeWithSeason } from "./types";
import { makeSlug } from "./parseSize";

export type SeasonCodeDigit = "01" | "02";

/**
 * 9 digits: WWW + PP + RR + SS
 * - WWW: width (3), zero-padded
 * - PP: profile (2)
 * - RR: rim code (2): 08-24 = inch; 60-74 = (inch+50) for C (10c-24c); 75/55/85/50 = 17.5/15.5/22.5/10.5
 * - SS: 01 = summer, 02 = winter
 */
export function encodeTireDigitCode(
  width: string,
  profile: string,
  diameter: string,
  season: "summer" | "winter",
): string {
  const ww = String(parseInt(width, 10))
    .padStart(3, "0")
    .slice(-3);
  const pp = String(parseInt(profile, 10))
    .padStart(2, "0")
    .slice(-2);
  const rr = rimDiameterToCode2(diameter);
  const ss: SeasonCodeDigit = season === "summer" ? "01" : "02";
  return `${ww}${pp}${rr}${ss}`;
}

function rimDiameterToCode2(d: string): string {
  const t = d.toLowerCase().trim();
  if (t === "17.5" || t === "17-5" || t === "175") {
    return "75";
  }
  if (t === "15.5" || t === "15-5") {
    return "55";
  }
  if (t === "22.5" || t === "22-5") {
    return "85";
  }
  if (t === "10.5" || t === "10-5") {
    return "50";
  }
  const c = t.match(/^(\d{1,2})c$/i);
  if (c) {
    const inch = parseInt(c[1], 10);
    if (inch >= 10 && inch <= 24) {
      return String(50 + inch).padStart(2, "0");
    }
  }
  const n = t.match(/^(\d{1,2})$/);
  if (n) {
    const inch = parseInt(n[1], 10);
    if (inch >= 8 && inch <= 24) {
      return String(inch).padStart(2, "0");
    }
  }
  const dot = t.match(/^(\d{1,2})\.(\d)$/);
  if (dot) {
    const a = parseInt(dot[1], 10);
    const b = parseInt(dot[2], 10);
    if (a === 17 && b === 5) {
      return "75";
    }
    if (a === 15 && b === 5) {
      return "55";
    }
    if (a === 22 && b === 5) {
      return "85";
    }
    if (a === 10 && b === 5) {
      return "50";
    }
  }
  throw new Error(`Cannot encode rim: ${d}`);
}

function code2ToRim(rr: string): string {
  const n = parseInt(rr, 10);
  if (n === 75) {
    return "17.5";
  }
  if (n === 55) {
    return "15.5";
  }
  if (n === 85) {
    return "22.5";
  }
  if (n === 50) {
    return "10.5";
  }
  if (n >= 60 && n <= 74) {
    return `${n - 50}c`;
  }
  if (n >= 8 && n <= 24) {
    return String(n);
  }
  return String(n);
}

export function decodeTireDigitCode(
  code: string,
):
  | { width: string; profile: string; diameter: string; season: "summer" | "winter" }
  | { error: string } {
  const t = code.replace(/\s/g, "");
  if (!/^\d{9}$/.test(t)) {
    return { error: "Нужен код из 9 цифр (…01 лето, …02 зима)" };
  }
  const ss = t.slice(7, 9);
  if (ss !== "01" && ss !== "02") {
    return { error: "Поз. 8–9: 01 — лето, 02 — зима" };
  }
  const season: "summer" | "winter" = ss === "01" ? "summer" : "winter";
  const width = String(parseInt(t.slice(0, 3), 10));
  const profile = String(parseInt(t.slice(3, 5), 10));
  const diameter = code2ToRim(t.slice(5, 7));
  return { width, profile, diameter, season };
}

export function digitCodeToParsedSize(
  code: string,
  seasonOverride?: "summer" | "winter",
): ParsedSizeWithSeason | { error: string } {
  const dec = decodeTireDigitCode(code);
  if ("error" in dec) {
    return dec;
  }
  const season = seasonOverride ?? dec.season;
  const { width, profile, diameter } = dec;
  const slug = makeSlug(width, profile, diameter);
  return { width, profile, diameter, slug, season };
}

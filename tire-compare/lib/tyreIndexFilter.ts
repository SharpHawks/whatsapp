/**
 * Optional load index (e.g. 91) and speed index letter (e.g. V) filter against offer titles.
 * Recognizes "91V", "91 V", and "109/107K" style (C) when both indices match.
 */

function normalize(s: string): string {
  return s.trim();
}

/**
 * Returns normalized filter or error for invalid user input.
 */
export function parseTireIndexQueryParams(
  loadRaw: string | null | undefined,
  speedRaw: string | null | undefined,
): { load?: string; speed?: string } | { error: string } {
  const load = loadRaw == null || loadRaw === "" ? undefined : normalize(loadRaw);
  const speed = speedRaw == null || speedRaw === "" ? undefined : normalize(speedRaw);

  if (load == null && speed == null) {
    return {};
  }
  if (load != null && !/^\d{2,3}$/.test(load)) {
    return { error: "Индекс нагрузки: 2–3 цифры, например 91 или 109" };
  }
  if (speed != null && !/^[A-HJ-NP-Z]{1,2}$/i.test(speed)) {
    return { error: "Скоростной индекс: буква(ы) A…Z, например V, W, H" };
  }
  return {
    load,
    speed: speed == null ? undefined : speed.toUpperCase(),
  };
}

/**
 * @returns true if the row should be kept when load/speed filters are set; always true if both are undefined.
 */
export function titleMatchesTireIndex(
  title: string,
  load: string | undefined,
  speed: string | undefined,
): boolean {
  if (load == null && speed == null) {
    return true;
  }
  const t = title;
  if (load != null && speed != null) {
    const a = load;
    const b = speed;
    if (t.replace(/\s/g, "").toUpperCase().includes(`${a}${b}`)) {
      return true;
    }
    const mC = t.match(/(\d{2,3})\/(\d{2,3})\s*([A-HJ-NP-Z]{1,2})/i);
    if (mC) {
      const [, p1, p2, sp] = mC;
      if (sp.toUpperCase() === b && (p1 === a || p2 === a)) {
        return true;
      }
    }
    return new RegExp(
      String.raw`(?<![0-9])${a}\s*${b}(?![A-Za-z0-9/])`,
      "i",
    ).test(t);
  }
  if (load != null) {
    return new RegExp(String.raw`(?<![0-9])${load}[A-HJ-NP-Z]`, "i").test(t);
  }
  return new RegExp(
    String.raw`(?:^|[^0-9/])(\d{2,3})${speed!}(?![0-9A-Za-z/])`,
    "i",
  ).test(t);
}

/**
 * Merges tire size slugs from MMK, Riepu Garāža, and R1 (d1×d2×d3 from R1 search form).
 * Run: node scripts/collect-sizes.mjs
 */
import * as cheerio from "cheerio";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

async function fetchText(url) {
  const r = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html,*/*" } });
  if (!r.ok) {
    throw new Error(`GET ${url} -> ${r.status}`);
  }
  return r.text();
}

const slugRe = /\/riepas\/(\d+)-(\d+)-r([0-9a-z.]+)(?:\/)?/gi;

function slugsFromUrlHtml(html) {
  const bySlug = new Map();
  for (const m of html.matchAll(slugRe)) {
    const w = m[1];
    const p = m[2];
    const raw = m[3].toLowerCase();
    const slug = `${w}-${p}-r${raw}`;
    if (!bySlug.has(slug)) {
      bySlug.set(slug, { width: w, profile: p, diameter: raw, slug });
    }
  }
  return bySlug;
}

function normalizeR1D3(t) {
  const s = t.trim();
  const m = s.match(/R?([0-9.]+)C?/i);
  if (!m) {
    return null;
  }
  let d = m[1].toLowerCase();
  if (s.toLowerCase().includes("c") && !d.endsWith("c")) {
    d = `${d}c`;
  }
  return d;
}

function buildSlug(w, p, d) {
  if (d.includes(".")) {
    return `${w}-${p}-r${d.replace(".", "-")}`;
  }
  return `${w}-${p}-r${d}`;
}

function parseR1SearchHtml(html) {
  const $ = cheerio.load(html);
  const d1s = new Set();
  const d2s = new Set();
  const d3s = new Set();
  $('select.tire-width option[id]').each((_, el) => {
    const id = $(el).attr("id");
    if (id && /^\d/.test(id)) {
      d1s.add(id);
    }
  });
  $('select.tire-height option[id]').each((_, el) => {
    const id = $(el).attr("id");
    if (id && /^\d/.test(id)) {
      d2s.add(id);
    }
  });
  $('select.tire-radius option[id]').each((_, el) => {
    const id = $(el).attr("id");
    if (id) {
      const d = normalizeR1D3(id);
      if (d) {
        d3s.add(d);
      }
    }
  });
  return {
    d1: [...d1s].sort((a, b) => parseFloat(a) - parseFloat(b)),
    d2: [...d2s].sort((a, b) => parseFloat(a) - parseFloat(b)),
    d3: [...d3s].sort(),
  };
}

function r1SlugMap(opts) {
  const bySlug = new Map();
  for (const w of opts.d1) {
    for (const p of opts.d2) {
      for (const d of opts.d3) {
        const slug = buildSlug(String(parseInt(String(w), 10)), String(parseInt(String(p), 10)), d);
        bySlug.set(slug, { width: String(parseInt(String(w), 10)), profile: String(parseInt(String(p), 10)), diameter: d, slug });
      }
    }
  }
  return bySlug;
}

async function main() {
  const mmkHub = "https://mmkriepas.lv/riepas/";
  const rgHub = "https://www.riepugaraza.lv/riepas/";
  const r1Url = "https://r1riepas.lv/vasaras-riepas/search?d1=205&d2=55&d3=16&top=show";

  console.log("Fetching pages…");
  const [mmkHtml, rgHtml, r1Html] = await Promise.all([fetchText(mmkHub), fetchText(rgHub), fetchText(r1Url)]);

  const mmk = slugsFromUrlHtml(mmkHtml);
  const rg = slugsFromUrlHtml(rgHtml);
  const r1opt = parseR1SearchHtml(r1Html);
  const r1 = r1SlugMap(r1opt);

  const merged = new Map();
  function add(m, name) {
    for (const [k, v] of m) {
      if (!merged.has(k)) {
        merged.set(k, { ...v, sources: new Set() });
      }
      merged.get(k).sources.add(name);
    }
  }
  add(mmk, "mmkriepas.lv");
  add(rg, "riepugaraza.lv");
  add(r1, "r1riepas.lv");

  const sizes = [...merged.values()]
    .map((s) => ({
      width: s.width,
      profile: s.profile,
      diameter: s.diameter,
      slug: s.slug,
      sources: [...s.sources].sort(),
    }))
    .sort((a, b) => a.slug.localeCompare(b.slug, "en"));

  const outDir = join(__dirname, "../data");
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, "tire-sizes.json");
  writeFileSync(
    outPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        count: sizes.length,
        d1: r1opt.d1.length,
        d2: r1opt.d2.length,
        d3: r1opt.d3.length,
        sizes,
      },
      null,
      2,
    ),
    "utf8",
  );
  console.log("Wrote", outPath, "unique slugs", sizes.length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

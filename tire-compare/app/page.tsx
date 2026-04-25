"use client";

import { AppLayout } from "@/components/AppLayout";
import { cn, formatShopTireSeason } from "@/lib/utils";
import type { ShopTireSeason } from "@/lib/types";
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { useCallback, useEffect, useMemo, useState } from "react";

type Offer = {
  id: string;
  source: string;
  title: string;
  price: number;
  listPrice: number | null;
  url: string;
  sizeLine: string | null;
  season: ShopTireSeason;
};

type SourceError = { source: string; message: string };

function sourceBadgeClass(source: string): string {
  if (source.includes("mmk")) return "bg-emerald-50 text-emerald-800 ring-emerald-600/20";
  if (source.includes("riepu")) return "bg-sky-50 text-sky-800 ring-sky-600/20";
  if (source.includes("r1")) return "bg-violet-50 text-violet-800 ring-violet-600/20";
  return "bg-gray-100 text-gray-800 ring-gray-500/10";
}

type SourceFilter = { mmk: boolean; rg: boolean; r1: boolean };

const defaultSourceFilter: SourceFilter = { mmk: true, rg: true, r1: true };

function offerMatchesSource(o: Offer, f: SourceFilter): boolean {
  if (o.source.includes("mmkriepas") || o.source === "mmkriepas.lv") {
    return f.mmk;
  }
  if (o.source.includes("riepu")) {
    return f.rg;
  }
  if (o.source.includes("r1")) {
    return f.r1;
  }
  return true;
}

function parsePriceBound(raw: string): number | null {
  const t = raw.trim().replace(",", ".");
  if (!t) {
    return null;
  }
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : null;
}

export default function Home() {
  const [q, setQ] = useState("205551601");
  const [loading, setLoading] = useState(false);
  const [offers, setOffers] = useState<Offer[] | null>(null);
  const [errors, setErrors] = useState<SourceError[]>([]);
  const [clientError, setClientError] = useState<string | null>(null);
  const [seasonText, setSeasonText] = useState<"summer" | "winter">("summer");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>(defaultSourceFilter);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [loadIndex, setLoadIndex] = useState("");
  const [speedIndex, setSpeedIndex] = useState("");
  const [appliedIndexFilter, setAppliedIndexFilter] = useState<{
    load?: string;
    speed?: string;
  } | null>(null);

  useEffect(() => {
    const t = q.trim();
    if (/^\d{9}$/.test(t)) {
      setSeasonText(t.slice(7, 9) === "02" ? "winter" : "summer");
    }
  }, [q]);

  const isNineDigit = /^\d{9}$/.test(q.trim());
  const season: "summer" | "winter" = isNineDigit
    ? q.trim().slice(7, 9) === "02"
      ? "winter"
      : "summer"
    : seasonText;

  const onSearch = useCallback(async () => {
    setLoading(true);
    setClientError(null);
    setErrors([]);
    try {
      const t = q.trim();
      const u = new URL("/api/search", window.location.origin);
      u.searchParams.set("q", t);
      if (!/^\d{9}$/.test(t)) {
        u.searchParams.set("season", seasonText === "winter" ? "winter" : "summer");
      }
      const l = loadIndex.trim();
      const s = speedIndex.trim();
      if (l) u.searchParams.set("load", l);
      if (s) u.searchParams.set("speed", s);
      const res = await fetch(u.toString());
      const data = (await res.json()) as {
        error?: string;
        offers: Offer[];
        errors: SourceError[];
      };
      if (!res.ok) {
        setOffers(null);
        setAppliedIndexFilter(null);
        setClientError(data.error ?? "Ошибка");
        return;
      }
      setAppliedIndexFilter(
        l || s ? { load: l || undefined, speed: s || undefined } : null,
      );
      setOffers(data.offers);
      setErrors(data.errors ?? []);
      setSourceFilter(defaultSourceFilter);
      setMinPrice("");
      setMaxPrice("");
    } catch (e) {
      setOffers(null);
      setAppliedIndexFilter(null);
      setClientError(e instanceof Error ? e.message : "Сеть");
    } finally {
      setLoading(false);
    }
  }, [q, seasonText, loadIndex, speedIndex]);

  const filteredOffers = useMemo(() => {
    if (!offers?.length) {
      return [];
    }
    const lo = parsePriceBound(minPrice);
    const hi = parsePriceBound(maxPrice);
    return offers.filter((o) => {
      if (!offerMatchesSource(o, sourceFilter)) {
        return false;
      }
      if (lo != null && o.price < lo) {
        return false;
      }
      if (hi != null && o.price > hi) {
        return false;
      }
      return true;
    });
  }, [offers, sourceFilter, minPrice, maxPrice]);

  return (
    <AppLayout>
      <div>
        <div className="sm:flex sm:items-end sm:justify-between sm:gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">Сравнение цен на шины</h1>
            <p className="mt-1 text-sm text-gray-500">
              mmkriepas.lv · riepugaraza.lv · r1riepas.lv — данные со страниц магазинов; перед покупкой проверьте цену
              на сайте.
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Параметры поиска</h2>
          <p className="mt-1 text-sm text-gray-500">
            Размер: <strong>9 цифр</strong> (01/02 в конце — сезон R1) или текст вроде{" "}
            <code className="rounded bg-gray-100 px-1">205/55/16</code>. По желанию укажите <strong>индекс нагрузки</strong> (91) и{" "}
            <strong>скоростной</strong> (V, W) — отфильтруем по названиям в выдаче магазинов.
          </p>
          <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end">
            <div className="min-w-0 flex-1">
              <label htmlFor="tire-size-q" className="mb-1.5 block text-sm font-medium text-gray-700">
                Размер или код
              </label>
              <input
                id="tire-size-q"
                name="q"
                type="text"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                autoComplete="off"
                placeholder="например 205551601 или 205/55/16"
                className="h-10 w-full max-w-2xl rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
            <div>
              <span className="mb-1.5 block text-sm font-medium text-gray-700">Сезон (R1)</span>
              <p className="mb-1.5 text-xs text-gray-500">Для 9 цифр — 01/02 в коде; для текста 205/55/16 — кнопками.</p>
              <div className="inline-flex rounded-md border border-gray-200 p-0.5 shadow-sm">
                <button
                  type="button"
                  onClick={() => {
                    if (/^\d{9}$/.test(q.trim())) {
                      setQ((prev) => prev.slice(0, 7) + "01");
                    } else {
                      setSeasonText("summer");
                    }
                  }}
                  className={cn(
                    "rounded px-3 py-2 text-sm font-medium transition-colors",
                    season === "summer" ? "bg-primary-500 text-white" : "text-gray-700 hover:bg-gray-50",
                  )}
                >
                  Лето 01
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (/^\d{9}$/.test(q.trim())) {
                      setQ((prev) => prev.slice(0, 7) + "02");
                    } else {
                      setSeasonText("winter");
                    }
                  }}
                  className={cn(
                    "rounded px-3 py-2 text-sm font-medium transition-colors",
                    season === "winter" ? "bg-primary-500 text-white" : "text-gray-700 hover:bg-gray-50",
                  )}
                >
                  Зима 02
                </button>
              </div>
            </div>
            <button
              type="button"
              className="btn-primary inline-flex h-10 shrink-0 items-center gap-2 self-start lg:ml-1"
              onClick={onSearch}
              disabled={loading}
            >
              {loading ? (
                <svg className="h-4 w-4 shrink-0 animate-spin" viewBox="0 0 24 24" aria-hidden>
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
              ) : (
                <MagnifyingGlassIcon className="h-5 w-5" />
              )}
              {loading ? "Поиск…" : "Найти"}
            </button>
          </div>
          <div className="mt-4 flex max-w-2xl flex-col gap-3 sm:flex-row sm:items-end sm:gap-4">
            <div>
              <label htmlFor="tire-load" className="mb-1.5 block text-sm font-medium text-gray-700">
                Индекс нагрузки
              </label>
              <input
                id="tire-load"
                type="text"
                inputMode="numeric"
                value={loadIndex}
                onChange={(e) => setLoadIndex(e.target.value.replace(/[^\d]/g, ""))}
                maxLength={3}
                autoComplete="off"
                placeholder="напр. 91"
                className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900 shadow-sm sm:w-28 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
            <div>
              <label htmlFor="tire-speed" className="mb-1.5 block text-sm font-medium text-gray-700">
                Скоростной индекс
              </label>
              <input
                id="tire-speed"
                type="text"
                value={speedIndex}
                onChange={(e) => setSpeedIndex(e.target.value.replace(/[^A-Za-z]/g, "").toUpperCase())}
                maxLength={2}
                autoComplete="off"
                placeholder="V, W, Y…"
                className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900 shadow-sm sm:w-24 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
            <p className="text-xs text-gray-500 sm:mb-1 sm:max-w-sm">
              Оставьте пустым, чтобы видеть все варианты в размере. Для C (напр. 109/107) укажите одну из цифр пары + индекса скорости.
            </p>
          </div>
        </div>

        {clientError && (
          <div
            className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"
            role="alert"
          >
            {clientError}
          </div>
        )}

        {errors.length > 0 && (
          <ul className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            {errors.map((e) => (
              <li key={e.source}>
                <span className="font-medium">{e.source}:</span> {e.message}
              </li>
            ))}
          </ul>
        )}

        {offers && offers.length === 0 && !loading && (
          <p className="mt-6 text-sm text-gray-500">Ничего не найдено.</p>
        )}

        {offers && offers.length > 0 && (
          <div className="mt-6 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">Результаты</h2>
              <p className="text-sm text-gray-500">
                Показано: <strong>{filteredOffers.length}</strong> из {offers.length} · сортировка: по цене (€) по возрастанию
              </p>
              {appliedIndexFilter != null && (appliedIndexFilter.load != null || appliedIndexFilter.speed != null) && (
                <p className="mt-1 text-sm text-primary-800">
                  Фильтр по индексам:{" "}
                  {[
                    appliedIndexFilter.load != null ? `нагр. ${appliedIndexFilter.load}` : null,
                    appliedIndexFilter.speed != null ? `скор. ${appliedIndexFilter.speed}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}{" "}
                  (по названиям в выдаче)
                </p>
              )}
            </div>
            <div className="border-b border-gray-100 bg-gray-50/80 px-6 py-4">
              <p className="mb-3 text-sm font-medium text-gray-800">Фильтры</p>
              <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:gap-6">
                <fieldset>
                  <legend className="mb-1.5 text-xs font-medium text-gray-600">Магазин</legend>
                  <div className="flex flex-wrap gap-3 text-sm text-gray-800">
                    <label className="inline-flex cursor-pointer items-center gap-1.5">
                      <input
                        type="checkbox"
                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        checked={sourceFilter.mmk}
                        onChange={(e) => setSourceFilter((f) => ({ ...f, mmk: e.target.checked }))}
                      />
                      mmkriepas.lv
                    </label>
                    <label className="inline-flex cursor-pointer items-center gap-1.5">
                      <input
                        type="checkbox"
                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        checked={sourceFilter.rg}
                        onChange={(e) => setSourceFilter((f) => ({ ...f, rg: e.target.checked }))}
                      />
                      riepugaraza.lv
                    </label>
                    <label className="inline-flex cursor-pointer items-center gap-1.5">
                      <input
                        type="checkbox"
                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        checked={sourceFilter.r1}
                        onChange={(e) => setSourceFilter((f) => ({ ...f, r1: e.target.checked }))}
                      />
                      r1riepas.lv
                    </label>
                  </div>
                </fieldset>
                <div className="flex flex-wrap items-end gap-3">
                  <div>
                    <label htmlFor="f-min" className="mb-1 block text-xs font-medium text-gray-600">
                      Цена от (€)
                    </label>
                    <input
                      id="f-min"
                      type="text"
                      inputMode="decimal"
                      value={minPrice}
                      onChange={(e) => setMinPrice(e.target.value)}
                      className="h-9 w-24 rounded-md border border-gray-300 px-2 text-sm"
                      placeholder="—"
                    />
                  </div>
                  <div>
                    <label htmlFor="f-max" className="mb-1 block text-xs font-medium text-gray-600">
                      до (€)
                    </label>
                    <input
                      id="f-max"
                      type="text"
                      inputMode="decimal"
                      value={maxPrice}
                      onChange={(e) => setMaxPrice(e.target.value)}
                      className="h-9 w-24 rounded-md border border-gray-300 px-2 text-sm"
                      placeholder="—"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSourceFilter({ ...defaultSourceFilter });
                      setMinPrice("");
                      setMaxPrice("");
                    }}
                    className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-700 shadow-sm hover:bg-gray-50"
                  >
                    Сбросить
                  </button>
                </div>
              </div>
            </div>
            {filteredOffers.length === 0 ? (
              <p className="px-6 py-8 text-sm text-amber-800">Ни одна позиция не подходит под выбранные фильтры. Снимите часть условий или нажмите «Сбросить».</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                        Магазин
                      </th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                        Сезон
                      </th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                        Название
                      </th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                        Цена
                      </th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                        Ссылка
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {filteredOffers.map((o) => (
                      <tr key={o.id} className="hover:bg-gray-50/80">
                        <td className="whitespace-nowrap px-4 py-3">
                          <span
                            className={cn(
                              "inline-flex max-w-full items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
                              sourceBadgeClass(o.source),
                            )}
                          >
                            {o.source}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-gray-600">{formatShopTireSeason(o.season)}</td>
                        <td className="px-4 py-3 text-gray-900">{o.title}</td>
                        <td className="whitespace-nowrap px-4 py-3 tabular-nums text-gray-900">
                          <span className="font-semibold">€{o.price.toFixed(2)}</span>
                          {o.listPrice != null && o.listPrice > o.price && (
                            <span className="ml-2 text-gray-400 line-through">€{o.listPrice.toFixed(2)}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <a
                            href={o.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-primary-600 hover:text-primary-700"
                          >
                            Открыть
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        <p className="mt-8 text-sm text-gray-500">
          Колонка «Сезон» — по данным магазина: R1 согласуется с выбранным вами 01/02, MMK из категории GTM, Riepu Garāža из URL
          товара. Цены и наличие проверяйте на сайте.
        </p>
      </div>
    </AppLayout>
  );
}

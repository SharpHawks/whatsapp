import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { ShopTireSeason } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatShopTireSeason(s: ShopTireSeason): string {
  if (s === "summer") return "Лето";
  if (s === "winter") return "Зима";
  if (s === "all_season") return "Всесез.";
  return "—";
}

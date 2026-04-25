"use client";

import { Bars3Icon, ChartBarIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type AppLayoutProps = {
  children: ReactNode;
};

const nav = [{ name: "Сравнение цен", href: "#", icon: ChartBarIcon, active: true }];

export function AppLayout({ children }: AppLayoutProps) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      {open && (
        <>
          <div
            className="fixed inset-0 z-40 bg-gray-900/80 lg:hidden"
            aria-hidden="true"
            onClick={() => setOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 z-50 w-full max-w-xs bg-white shadow-xl lg:hidden">
            <div className="flex h-16 items-center justify-between border-b border-gray-200 px-4">
              <span className="text-lg font-bold text-primary-600">Шины — LV</span>
              <button
                type="button"
                className="rounded-md p-2 text-gray-500 hover:bg-gray-100"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            <nav className="p-4">
              <ul className="space-y-1">
                {nav.map((item) => (
                  <li key={item.name}>
                    <span
                      className={cn(
                        item.active
                          ? "bg-primary-50 text-primary-600"
                          : "text-gray-700 hover:bg-gray-50",
                        "flex gap-3 rounded-md p-2 text-sm font-semibold",
                      )}
                    >
                      <item.icon className="h-6 w-6 shrink-0" />
                      {item.name}
                    </span>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </>
      )}

      <div className="sticky top-0 z-40 flex items-center gap-x-4 border-b border-gray-200 bg-white px-4 py-4 shadow-sm sm:px-6 lg:hidden">
        <button
          type="button"
          className="-m-2.5 p-2.5 text-gray-700"
          onClick={() => setOpen(true)}
        >
          <span className="sr-only">Open menu</span>
          <Bars3Icon className="h-6 w-6" />
        </button>
        <div className="text-sm font-semibold leading-6 text-gray-900">Шины — LV</div>
      </div>

      <div className="hidden lg:fixed lg:inset-y-0 lg:z-30 lg:flex lg:w-72 lg:flex-col">
        <div className="flex grow flex-col gap-y-5 overflow-y-auto border-r border-gray-200 bg-white px-6">
          <div className="flex h-16 shrink-0 items-center">
            <h1 className="text-xl font-bold text-primary-600">Шины — LV</h1>
          </div>
          <nav>
            <ul className="space-y-1">
              {nav.map((item) => (
                <li key={item.name}>
                  <span
                    className={cn(
                      item.active
                        ? "bg-primary-50 text-primary-600"
                        : "text-gray-700 hover:bg-gray-50",
                      "group flex cursor-default gap-3 rounded-md p-2 text-sm font-semibold",
                    )}
                  >
                    <item.icon
                      className={cn(
                        item.active ? "text-primary-600" : "text-gray-400",
                        "h-6 w-6 shrink-0",
                      )}
                    />
                    {item.name}
                  </span>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>

      <main className="py-8 lg:pl-72">
        <div className="px-4 sm:px-6 lg:px-8">{children}</div>
      </main>
    </div>
  );
}

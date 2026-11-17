"use client";

import { createContext, useContext, useMemo, useState } from "react";

import type { ProductCategory } from "@/lib/catalog";

export type FilterValue = "all" | ProductCategory;

type ShopFilterContextValue = {
  filter: FilterValue;
  setFilter: (value: FilterValue) => void;
};

const ShopFilterContext = createContext<ShopFilterContextValue | null>(null);

/**
 * Shared so the collection tiles can drive the shop filter further down the
 * page, which is what `data-filter-link` did in the original.
 */
export function ShopFilterProvider({ children }: { children: React.ReactNode }) {
  const [filter, setFilter] = useState<FilterValue>("all");
  const value = useMemo(() => ({ filter, setFilter }), [filter]);
  return (
    <ShopFilterContext.Provider value={value}>{children}</ShopFilterContext.Provider>
  );
}

export function useShopFilter(): ShopFilterContextValue {
  const ctx = useContext(ShopFilterContext);
  if (!ctx) throw new Error("useShopFilter must be used inside <ShopFilterProvider>");
  return ctx;
}

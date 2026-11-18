"use client";

import { useRouter } from "next/navigation";

import { SORTS, shopHref, type ShopFilters, type SortKey } from "@/lib/shop-filters";

/** Sorting navigates, so the chosen order is part of the shareable URL. */
export function SortSelect({ filters }: { filters: ShopFilters }) {
  const router = useRouter();

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <label
        htmlFor="shop-sort"
        style={{
          fontSize: "0.72rem",
          fontWeight: 800,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "var(--text-muted)",
        }}
      >
        Sort
      </label>
      <select
        id="shop-sort"
        className="sort-select"
        value={filters.sort}
        onChange={(event) =>
          router.push(
            shopHref(filters, { sort: event.target.value as SortKey, page: 1 }),
          )
        }
      >
        {Object.entries(SORTS).map(([key, { label }]) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
      </select>
    </div>
  );
}

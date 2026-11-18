import type { Prisma } from "@prisma/client";

/**
 * Shop listing filters — the URL contract.
 *
 * Deliberately free of `server-only` and of any Prisma *value* import (the
 * type import above is erased at compile time), because the sort dropdown and
 * the search box are client components and need these same definitions. The
 * query itself lives in lib/shop-query.ts, which is server-only.
 *
 * Each parameter is parsed into a closed set of values, so an unrecognised one
 * falls back to the default rather than reaching the database: `?sort=anything`
 * is simply the default sort.
 */

export const SORTS = {
  featured: {
    label: "Featured",
    orderBy: [{ isFeatured: "desc" }, { sortOrder: "asc" }],
  },
  newest: { label: "Newest", orderBy: [{ createdAt: "desc" }] },
  "price-asc": { label: "Price: low to high", orderBy: [{ minPrice: "asc" }] },
  "price-desc": { label: "Price: high to low", orderBy: [{ minPrice: "desc" }] },
  name: { label: "Name: A–Z", orderBy: [{ name: "asc" }] },
} satisfies Record<
  string,
  { label: string; orderBy: Prisma.ProductOrderByWithRelationInput[] }
>;

export type SortKey = keyof typeof SORTS;

export const PRICE_BANDS = {
  "under-25000": { label: "Under 25,000", min: null, max: 25_000 },
  "25000-50000": { label: "25,000 – 50,000", min: 25_000, max: 50_000 },
  "50000-100000": { label: "50,000 – 100,000", min: 50_000, max: 100_000 },
  "over-100000": { label: "Over 100,000", min: 100_000, max: null },
} satisfies Record<string, { label: string; min: number | null; max: number | null }>;

export type PriceBand = keyof typeof PRICE_BANDS;

export const PAGE_SIZE = 12;

export type ShopParams = {
  category?: string;
  q?: string;
  price?: string;
  sort?: string;
  page?: string;
  stock?: string;
};

export type ShopFilters = {
  category: string | null;
  q: string;
  price: PriceBand | null;
  sort: SortKey;
  page: number;
  inStockOnly: boolean;
};

export function parseShopParams(params: ShopParams): ShopFilters {
  return {
    // Not validated against the category list: an unknown slug yields an empty
    // result page, which is the right answer, rather than an error.
    category: params.category?.trim() || null,
    q: (params.q ?? "").trim().slice(0, 80),
    price: isBand(params.price) ? params.price : null,
    sort: isSort(params.sort) ? params.sort : "featured",
    page: Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1),
    inStockOnly: params.stock === "in",
  };
}

function isSort(value: string | undefined): value is SortKey {
  return !!value && Object.hasOwn(SORTS, value);
}

function isBand(value: string | undefined): value is PriceBand {
  return !!value && Object.hasOwn(PRICE_BANDS, value);
}

/** Build a shop URL, dropping defaults so the links stay readable. */
export function shopHref(filters: ShopFilters, patch: Partial<ShopFilters>): string {
  const next = { ...filters, ...patch };
  const search = new URLSearchParams();

  if (next.category) search.set("category", next.category);
  if (next.q) search.set("q", next.q);
  if (next.price) search.set("price", next.price);
  if (next.sort !== "featured") search.set("sort", next.sort);
  if (next.inStockOnly) search.set("stock", "in");
  /*
   * Paging is carried only when the caller asked for a page. Every filter link
   * passes `page: 1`, so narrowing from page 4 lands on results rather than on
   * an empty page — the classic faceted-search bug.
   */
  if (patch.page !== undefined && next.page > 1) {
    search.set("page", String(next.page));
  }

  const qs = search.toString();
  return qs ? `/shop?${qs}` : "/shop";
}

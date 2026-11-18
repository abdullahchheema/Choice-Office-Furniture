import type { Metadata } from "next";
import Link from "next/link";

import { ProductGrid } from "@/components/shop/ProductGrid";
import { SearchBox } from "@/components/shop/SearchBox";
import { SortSelect } from "@/components/shop/SortSelect";
import { getActiveCategories, getSettings } from "@/lib/queries";
import {
  PRICE_BANDS,
  parseShopParams,
  shopHref,
  type ShopFilters,
  type ShopParams,
} from "@/lib/shop-filters";
import { queryShop } from "@/lib/shop-query";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Office furniture",
  description:
    "Executive and ergonomic chairs, desks, conference tables, storage and accessories — in stock and delivered across Pakistan.",
  alternates: { canonical: "/shop" },
};

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<ShopParams>;
}) {
  const filters = parseShopParams(await searchParams);
  const settings = await getSettings();

  const [categories, result] = await Promise.all([
    getActiveCategories(),
    queryShop(filters, settings.currencySymbol),
  ]);

  const activeCategory = categories.find((c) => c.slug === filters.category);

  return (
    <section className="section section--flush">
      <div className="shell">
        <header className="page-head" data-reveal>
          <nav className="crumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link>
            <span aria-hidden="true">/</span>
            {activeCategory ? <Link href="/shop">Shop</Link> : <span>Shop</span>}
            {activeCategory ? (
              <>
                <span aria-hidden="true">/</span>
                <span>{activeCategory.name}</span>
              </>
            ) : null}
          </nav>
          <h1>{activeCategory ? activeCategory.name : "Everything we make"}</h1>
          <p className="lede">
            {activeCategory?.description ??
              "Office furniture built for daily use — chairs, desks, tables, storage and the details around them."}
          </p>
        </header>

        <div className="shop-layout">
          {/*
            Filters are links, not a client-side array filter. That makes every
            view linkable and shareable, keeps the listing server-rendered for
            search engines, and means paging and filtering cannot disagree
            about what is on screen.
          */}
          <aside className="facets" aria-label="Filter products">
            <SearchBox filters={filters} />

            <fieldset>
              <legend>Category</legend>
              <ul>
                <li>
                  <Link
                    className="facet-link"
                    aria-current={!filters.category}
                    href={shopHref(filters, { category: null, page: 1 })}
                  >
                    All categories
                  </Link>
                </li>
                {categories.map((category) => (
                  <li key={category.id}>
                    <Link
                      className="facet-link"
                      aria-current={filters.category === category.slug}
                      href={shopHref(filters, { category: category.slug, page: 1 })}
                    >
                      <span>{category.name}</span>
                      <span className="count">{category.productCount}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </fieldset>

            <fieldset>
              <legend>Price ({settings.currencySymbol})</legend>
              <ul>
                <li>
                  <Link
                    className="facet-link"
                    aria-current={!filters.price}
                    href={shopHref(filters, { price: null, page: 1 })}
                  >
                    Any price
                  </Link>
                </li>
                {Object.entries(PRICE_BANDS).map(([key, band]) => (
                  <li key={key}>
                    <Link
                      className="facet-link"
                      aria-current={filters.price === key}
                      href={shopHref(filters, {
                        price: key as keyof typeof PRICE_BANDS,
                        page: 1,
                      })}
                    >
                      {band.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </fieldset>

            <fieldset>
              <legend>Availability</legend>
              <ul>
                <li>
                  <Link
                    className="facet-link"
                    aria-current={!filters.inStockOnly}
                    href={shopHref(filters, { inStockOnly: false, page: 1 })}
                  >
                    Show everything
                  </Link>
                </li>
                <li>
                  <Link
                    className="facet-link"
                    aria-current={filters.inStockOnly}
                    href={shopHref(filters, { inStockOnly: true, page: 1 })}
                  >
                    In stock only
                  </Link>
                </li>
              </ul>
            </fieldset>
          </aside>

          <div>
            <div className="shop-toolbar">
              <p className="shop-count" aria-live="polite">
                {result.total === 0
                  ? "No matches"
                  : `${result.total} product${result.total === 1 ? "" : "s"}`}
                {filters.q ? ` for “${filters.q}”` : ""}
              </p>
              <SortSelect filters={filters} />
            </div>

            {result.products.length === 0 ? (
              <div className="empty-state">
                <h2>Nothing matches those filters</h2>
                <p>
                  Try a wider price band or a different category — or message us and
                  we&apos;ll source it.
                </p>
                <Link className="btn btn--primary" href="/shop">
                  Clear all filters
                </Link>
              </div>
            ) : (
              <>
                <ProductGrid products={result.products} />
                <Pager filters={filters} pageCount={result.pageCount} />
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function Pager({ filters, pageCount }: { filters: ShopFilters; pageCount: number }) {
  if (pageCount <= 1) return null;

  // A window around the current page, so 40 pages do not render 40 links.
  const pages = new Set<number>([1, pageCount]);
  for (let p = filters.page - 1; p <= filters.page + 1; p += 1) {
    if (p >= 1 && p <= pageCount) pages.add(p);
  }
  const ordered = [...pages].sort((a, b) => a - b);

  return (
    <nav className="pager" aria-label="Pagination">
      {filters.page > 1 ? (
        <Link href={shopHref(filters, { page: filters.page - 1 })} rel="prev">
          ← Prev
        </Link>
      ) : null}

      {ordered.map((page, index) => (
        <span key={page} style={{ display: "contents" }}>
          {index > 0 && page - ordered[index - 1] > 1 ? (
            <span className="gap" aria-hidden="true">
              …
            </span>
          ) : null}
          {page === filters.page ? (
            <span aria-current="page">{page}</span>
          ) : (
            <Link href={shopHref(filters, { page })}>{page}</Link>
          )}
        </span>
      ))}

      {filters.page < pageCount ? (
        <Link href={shopHref(filters, { page: filters.page + 1 })} rel="next">
          Next →
        </Link>
      ) : null}
    </nav>
  );
}

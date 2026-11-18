import type { Prisma } from "@prisma/client";
import { Plus } from "lucide-react";
import Link from "next/link";

import { formatMoney } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { getSettingsOrNull } from "@/lib/queries";
import { safeQuery } from "@/lib/safe";
import { resolveImageSrc } from "@/lib/storage/resolve";

export const metadata = { title: "Products" };

const PAGE_SIZE = 20;

const STATUS_STYLES: Record<string, string> = {
  PUBLISHED: "bg-espresso text-cream",
  DRAFT: "bg-sand text-espresso",
  ARCHIVED: "border border-line text-text-muted",
};

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const status = params.status ?? "";
  const page = Math.max(1, Number(params.page ?? 1) || 1);

  // Narrowed to the enum before it reaches Prisma — a bare string here breaks
  // type inference for the whole query, including the `include` clause.
  const statusFilter = (["PUBLISHED", "DRAFT", "ARCHIVED"] as const).find(
    (value) => value === status,
  );

  const where: Prisma.ProductWhereInput = {
    ...(query
      ? {
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { sku: { contains: query, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(statusFilter ? { status: statusFilter } : {}),
  };

  const result = await safeQuery(
    "admin product list",
    async () => {
      const [rows, total, settings] = await Promise.all([
        prisma.product.findMany({
          where,
          include: {
            category: { select: { name: true } },
            images: { where: { isPrimary: true }, take: 1 },
          },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
          skip: (page - 1) * PAGE_SIZE,
          take: PAGE_SIZE,
        }),
        prisma.product.count({ where }),
        getSettingsOrNull(),
      ]);
      return { rows, total, symbol: settings?.currencySymbol ?? "Rs." };
    },
    { rows: [], total: 0, symbol: "Rs." },
  );

  const pages = Math.max(1, Math.ceil(result.total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink">
            Products
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            {result.total} {result.total === 1 ? "product" : "products"}
          </p>
        </div>
        <Link
          href="/admin/products/new"
          className="inline-flex items-center gap-2 rounded-full bg-espresso px-5 py-2.5 text-sm font-bold text-cream transition-colors hover:bg-walnut"
        >
          <Plus size={16} aria-hidden="true" />
          New product
        </Link>
      </header>

      <form method="get" className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Search name or SKU…"
          aria-label="Search products"
          className="min-w-[14rem] flex-1 rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus-visible:border-clay"
        />
        <select
          name="status"
          defaultValue={status}
          aria-label="Filter by status"
          className="rounded-md border border-line bg-white px-3 py-2 text-sm"
        >
          <option value="">All statuses</option>
          <option value="PUBLISHED">Published</option>
          <option value="DRAFT">Draft</option>
          <option value="ARCHIVED">Archived</option>
        </select>
        <button
          type="submit"
          className="rounded-full border border-espresso px-4 py-2 text-sm font-bold text-espresso transition-colors hover:bg-espresso hover:text-cream"
        >
          Filter
        </button>
      </form>

      <div className="overflow-hidden rounded-card border border-line bg-white">
        {result.rows.length === 0 ? (
          <p className="p-8 text-center text-sm text-text-muted">
            No products match. {query || status ? "Try clearing the filters." : ""}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-cream text-xs uppercase tracking-[0.1em] text-text-muted">
                <tr>
                  <th scope="col" className="px-4 py-3 font-bold">Product</th>
                  <th scope="col" className="px-4 py-3 font-bold">SKU</th>
                  <th scope="col" className="px-4 py-3 font-bold">Category</th>
                  <th scope="col" className="px-4 py-3 text-right font-bold">Price</th>
                  <th scope="col" className="px-4 py-3 text-right font-bold">Stock</th>
                  <th scope="col" className="px-4 py-3 font-bold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {result.rows.map((product) => {
                  const image = product.images[0];
                  const low =
                    product.trackInventory &&
                    product.stockQuantity <= product.lowStockThreshold;
                  return (
                    <tr key={product.id} className="hover:bg-cream/60">
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/products/${product.id}`}
                          className="flex items-center gap-3"
                        >
                          <span
                            className="h-11 w-11 shrink-0 overflow-hidden rounded-md border border-line"
                            style={{ background: product.toneHex ?? "#EFE6D8" }}
                          >
                            {image ? (
                              // eslint-disable-next-line @next/next/no-img-element -- admin thumbnail
                              <img
                                src={resolveImageSrc(image.storagePath)}
                                alt=""
                                className="h-full w-full object-cover"
                                style={{
                                  objectPosition: image.objectPosition ?? "50% 50%",
                                }}
                              />
                            ) : null}
                          </span>
                          <span className="font-semibold text-espresso hover:text-clay">
                            {product.name}
                          </span>
                        </Link>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-text-muted">
                        {product.sku}
                      </td>
                      <td className="px-4 py-3 text-text-muted">
                        {product.category.name}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">
                        {formatMoney(product.price, result.symbol)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={low ? "font-bold text-clay" : ""}>
                          {product.trackInventory ? product.stockQuantity : "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block rounded-full px-2.5 py-1 text-[0.7rem] font-bold uppercase tracking-wide ${
                            STATUS_STYLES[product.status]
                          }`}
                        >
                          {product.status.toLowerCase()}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {pages > 1 && (
        <nav className="flex items-center justify-center gap-2" aria-label="Pagination">
          {Array.from({ length: pages }, (_, index) => index + 1).map((n) => {
            const search = new URLSearchParams();
            if (query) search.set("q", query);
            if (status) search.set("status", status);
            search.set("page", String(n));
            return (
              <Link
                key={n}
                href={`/admin/products?${search}`}
                aria-current={n === page ? "page" : undefined}
                className={`rounded-md px-3 py-1.5 text-sm font-semibold ${
                  n === page
                    ? "bg-espresso text-cream"
                    : "border border-line text-espresso hover:bg-sand/50"
                }`}
              >
                {n}
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}

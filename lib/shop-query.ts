import "server-only";

import type { Prisma } from "@prisma/client";

import { toProductDTO, type ProductDTO } from "@/lib/dto";
import { prisma } from "@/lib/prisma";
import { PAGE_SIZE, PRICE_BANDS, SORTS, type ShopFilters } from "@/lib/shop-filters";

/** The shop listing query. The URL contract lives in lib/shop-filters.ts. */
export async function queryShop(
  filters: ShopFilters,
  currencySymbol: string,
): Promise<{ products: ProductDTO[]; total: number; pageCount: number }> {
  const band = filters.price ? PRICE_BANDS[filters.price] : null;

  const where: Prisma.ProductWhereInput = {
    status: "PUBLISHED",
    ...(filters.category ? { category: { slug: filters.category } } : {}),
    ...(band
      ? {
          price: {
            ...(band.min !== null ? { gte: band.min } : {}),
            ...(band.max !== null ? { lt: band.max } : {}),
          },
        }
      : {}),
    /* "In stock" must let untracked products through: trackInventory false
       means stock is not being counted, not that there is none. */
    ...(filters.inStockOnly
      ? { OR: [{ trackInventory: false }, { stockQuantity: { gt: 0 } }] }
      : {}),
    ...(filters.q
      ? {
          AND: filters.q
            .split(/\s+/)
            .filter(Boolean)
            // Every word must match somewhere, so "mesh chair" finds a mesh
            // chair rather than everything containing either word.
            .map((term) => ({
              OR: [
                { name: { contains: term, mode: "insensitive" as const } },
                { shortDescription: { contains: term, mode: "insensitive" as const } },
                { sku: { contains: term, mode: "insensitive" as const } },
                { material: { contains: term, mode: "insensitive" as const } },
                {
                  category: {
                    name: { contains: term, mode: "insensitive" as const },
                  },
                },
              ],
            })),
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: {
        category: { select: { name: true, slug: true } },
        images: { orderBy: { sortOrder: "asc" } },
      },
      /* A stable tiebreak after the chosen sort. Without it, rows with equal
         prices can be returned in a different order per page and a product
         then appears twice, or never. */
      orderBy: [...SORTS[filters.sort].orderBy, { id: "asc" }],
      skip: (filters.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.product.count({ where }),
  ]);

  return {
    products: rows.map((row) => toProductDTO(row, currencySymbol)),
    total,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

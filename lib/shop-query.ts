import "server-only";

import type { Prisma } from "@prisma/client";

import { CARD_INCLUDE, toProductDTO, type ProductDTO } from "@/lib/dto";
import { prisma } from "@/lib/prisma";
import { PAGE_SIZE, PRICE_BANDS, SORTS, type ShopFilters } from "@/lib/shop-filters";

/** The shop listing query. The URL contract lives in lib/shop-filters.ts. */
export async function queryShop(
  filters: ShopFilters,
  currencySymbol: string,
): Promise<{ products: ProductDTO[]; total: number; pageCount: number }> {
  const band = filters.price ? PRICE_BANDS[filters.price] : null;

  /*
   * Price, availability and search are conditions on the VARIANTS — a product
   * matches a price band if any of its active variants does, and is "in stock"
   * if any active variant can be bought. Each lives in its own AND clause so
   * they combine instead of overwriting one another's `variants` key.
   */
  const and: Prisma.ProductWhereInput[] = [];

  if (band) {
    and.push({
      variants: {
        some: {
          isActive: true,
          price: {
            ...(band.min !== null ? { gte: band.min } : {}),
            ...(band.max !== null ? { lt: band.max } : {}),
          },
        },
      },
    });
  }

  /* "In stock" must let untracked variants through: trackInventory false means
     stock is not being counted, not that there is none. */
  if (filters.inStockOnly) {
    and.push({
      variants: {
        some: {
          isActive: true,
          OR: [{ trackInventory: false }, { stockQuantity: { gt: 0 } }],
        },
      },
    });
  }

  // Every word must match somewhere, so "mesh chair" finds a mesh chair rather
  // than everything containing either word.
  for (const term of filters.q.split(/\s+/).filter(Boolean)) {
    const like = { contains: term, mode: "insensitive" as const };
    and.push({
      OR: [
        { name: like },
        { shortDescription: like },
        { sku: like },
        { category: { name: like } },
        { variants: { some: { isActive: true, sku: like } } },
        { specifications: { some: { value: like } } },
        { attributes: { some: { values: { some: { value: like } } } } },
      ],
    });
  }

  const where: Prisma.ProductWhereInput = {
    status: "PUBLISHED",
    // Nothing to sell, nothing to list.
    variants: { some: { isActive: true } },
    ...(filters.category ? { category: { slug: filters.category } } : {}),
    ...(and.length > 0 ? { AND: and } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: CARD_INCLUDE,
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

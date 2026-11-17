import "server-only";

import { cache } from "react";

import { toCategoryDTO, toProductDTO, type CategoryDTO, type ProductDTO } from "@/lib/dto";
import { prisma } from "@/lib/prisma";

/**
 * Read paths for the storefront.
 *
 * Everything is wrapped in React's `cache()` so a single render pass reuses
 * one query even when several sections ask for the same data — the homepage
 * reads settings in three places.
 */

const PRODUCT_INCLUDE = {
  category: { select: { name: true, slug: true } },
  images: { orderBy: { sortOrder: "asc" } },
} as const;

export const getSettings = cache(async () => {
  const settings = await prisma.websiteSetting.findUnique({
    where: { id: "singleton" },
  });

  if (!settings) {
    throw new Error(
      "Website settings row is missing. Run `npm run db:seed` to create it.",
    );
  }

  return settings;
});

/** Safe variant for pages that should still render before the DB is seeded. */
export const getSettingsOrNull = cache(async () => {
  try {
    return await prisma.websiteSetting.findUnique({ where: { id: "singleton" } });
  } catch {
    return null;
  }
});

export const getFeaturedProducts = cache(async (limit = 8): Promise<ProductDTO[]> => {
  const settings = await getSettingsOrNull();
  const products = await prisma.product.findMany({
    where: { status: "PUBLISHED", isFeatured: true },
    include: PRODUCT_INCLUDE,
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    take: limit,
  });

  return products.map((product) =>
    toProductDTO(product, settings?.currencySymbol ?? "Rs."),
  );
});

export const getShopProducts = cache(async (limit = 12): Promise<ProductDTO[]> => {
  const settings = await getSettingsOrNull();
  const products = await prisma.product.findMany({
    where: { status: "PUBLISHED" },
    include: PRODUCT_INCLUDE,
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    take: limit,
  });

  return products.map((product) =>
    toProductDTO(product, settings?.currencySymbol ?? "Rs."),
  );
});

export const getHomepageCategories = cache(async (): Promise<CategoryDTO[]> => {
  const categories = await prisma.category.findMany({
    where: { isActive: true, showOnHomepage: true },
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { products: { where: { status: "PUBLISHED" } } } } },
  });

  return categories.map(toCategoryDTO);
});

export const getActiveCategories = cache(async (): Promise<CategoryDTO[]> => {
  const categories = await prisma.category.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { products: { where: { status: "PUBLISHED" } } } } },
  });

  return categories.map(toCategoryDTO);
});

/**
 * Minimal product data the cart needs to render a line.
 *
 * The cart stores ids and quantities only; names, prices and images are
 * resolved from here on every render, so a price edited in the admin is
 * reflected immediately and a stale localStorage entry can never show a stale
 * price. Phase 5's checkout re-reads them again server-side regardless.
 */
export type CartCatalogEntry = {
  id: string;
  slug: string;
  name: string;
  priceLabel: string;
  priceValue: string;
  image: { src: string; objectPosition: string | null } | null;
};

export const getCartCatalog = cache(async (): Promise<CartCatalogEntry[]> => {
  const products = await getShopProducts(500);
  return products.map((product) => ({
    id: product.id,
    slug: product.slug,
    name: product.name,
    priceLabel: product.priceLabel,
    priceValue: product.priceValue,
    image: product.image
      ? { src: product.image.src, objectPosition: product.image.objectPosition }
      : null,
  }));
});

export const getHomepageSections = cache(async () => {
  const sections = await prisma.homepageSection.findMany({
    where: { isVisible: true },
    orderBy: { sortOrder: "asc" },
  });

  return new Map(sections.map((section) => [section.key, section]));
});

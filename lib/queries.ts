import "server-only";

import { cache } from "react";

import {
  CARD_INCLUDE,
  DETAIL_INCLUDE,
  MAX_LINE_QTY,
  toCategoryDTO,
  toProductDetailDTO,
  toProductDTO,
  type CategoryDTO,
  type ProductDetailDTO,
  type ProductDTO,
} from "@/lib/dto";
import { prisma } from "@/lib/prisma";
import { resolveImageSrc } from "@/lib/storage/resolve";
import { variantLabel } from "@/lib/variants";

/**
 * Read paths for the storefront.
 *
 * Everything is wrapped in React's `cache()` so a single render pass reuses
 * one query even when several sections ask for the same data — the homepage
 * reads settings in three places.
 */

/*
 * A product is only listed when something under it can be sold: published, and
 * with at least one active variant. Without the second condition a variable
 * product whose variants were all deactivated would show on the shop with no
 * price and nothing to buy.
 */
const LISTED = { status: "PUBLISHED", variants: { some: { isActive: true } } } as const;

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
    where: { ...LISTED, isFeatured: true },
    include: CARD_INCLUDE,
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
    where: { ...LISTED },
    include: CARD_INCLUDE,
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
 * What the cart needs to render one line — and a "line" is a VARIANT.
 *
 * The cart stores variant ids and quantities only; names, options, SKUs,
 * prices, photos and stock are resolved from here on every render, so a price
 * edited in the admin is reflected immediately and a stale localStorage entry
 * can never show a stale price. Checkout re-reads every one of them again
 * server-side regardless.
 */
export type CartCatalogEntry = {
  /** The variant id — what the cart stores and checkout submits. */
  id: string;
  productId: string;
  slug: string;
  name: string;
  /** "Black / Leather", or null for a simple product. */
  variantLabel: string | null;
  sku: string;
  priceLabel: string;
  priceValue: string;
  image: { src: string; objectPosition: string | null } | null;
  inStock: boolean;
  /** The most one order may take of this variant. */
  maxQty: number;
};

export const getCartCatalog = cache(async (): Promise<CartCatalogEntry[]> => {
  const settings = await getSettingsOrNull();
  const symbol = settings?.currencySymbol ?? "Rs.";

  const variants = await prisma.productVariant.findMany({
    where: { isActive: true, product: { status: "PUBLISHED" } },
    orderBy: [{ productId: "asc" }, { sortOrder: "asc" }],
    take: 2000,
    include: {
      images: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }], take: 1 },
      options: {
        include: {
          attribute: { select: { sortOrder: true, name: true } },
          value: { select: { value: true } },
        },
      },
      product: {
        select: {
          id: true,
          slug: true,
          name: true,
          type: true,
          imageObjectPosition: true,
          images: {
            where: { variantId: null },
            orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
            take: 1,
          },
        },
      },
    },
  });

  return variants.map((variant) => {
    const label = variantLabel(
      [...variant.options]
        .sort((a, b) => a.attribute.sortOrder - b.attribute.sortOrder)
        .map((o) => ({ name: o.attribute.name, value: o.value.value })),
    );
    // A variant's own photo wins; otherwise the product's shared one.
    const photo = variant.images[0] ?? variant.product.images[0] ?? null;
    const price = Number(variant.price);
    return {
      id: variant.id,
      productId: variant.product.id,
      slug: variant.product.slug,
      name: variant.product.name,
      variantLabel: label || null,
      sku: variant.sku,
      priceLabel: `${symbol} ${new Intl.NumberFormat("en-US").format(Math.round(price))}`,
      priceValue: variant.price.toFixed(2),
      image: photo
        ? {
            src: resolveImageSrc(photo.storagePath),
            objectPosition: photo.objectPosition ?? variant.product.imageObjectPosition,
          }
        : null,
      inStock: !variant.trackInventory || variant.stockQuantity > 0,
      maxQty: variant.trackInventory
        ? Math.min(MAX_LINE_QTY, Math.max(0, variant.stockQuantity))
        : MAX_LINE_QTY,
    };
  });
});

/** The product page's data: a published product with sellable variants, or null. */
export const getProductDetail = cache(async (slug: string): Promise<ProductDetailDTO | null> => {
  const [product, settings] = await Promise.all([
    prisma.product.findFirst({
      // status in the WHERE, not checked afterwards: a DRAFT or ARCHIVED product
      // must 404, not render with a "not available" notice search engines index.
      where: { slug, ...LISTED },
      include: DETAIL_INCLUDE,
    }),
    getSettingsOrNull(),
  ]);
  return product ? toProductDetailDTO(product, settings?.currencySymbol ?? "Rs.") : null;
});

export const getHomepageSections = cache(async () => {
  const sections = await prisma.homepageSection.findMany({
    where: { isVisible: true },
    orderBy: { sortOrder: "asc" },
  });

  return new Map(sections.map((section) => [section.key, section]));
});

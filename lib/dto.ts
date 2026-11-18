import type { Category, Product, ProductImage } from "@prisma/client";

import { discountPercent, toMoneyString } from "@/lib/money";
import { resolveImageSrc } from "@/lib/storage/resolve";

/**
 * Serialisable shapes for crossing into client components.
 *
 * Prisma rows cannot cross that boundary: `Decimal` is a class instance and
 * React throws "Only plain objects can be passed". Mapping through here is the
 * single place that conversion happens, and money becomes a STRING rather than
 * a number so the float hazard cannot sneak back in.
 *
 * These types are deliberately not structurally compatible with the Prisma
 * models, so passing a raw row where a DTO is expected is a type error.
 */

export type ProductImageDTO = {
  src: string;
  alt: string;
  width: number | null;
  height: number | null;
  objectPosition: string | null;
};

export type ProductDTO = {
  id: string;
  slug: string;
  sku: string;
  name: string;
  /** Formatted for display, e.g. "Rs. 48,500". */
  priceLabel: string;
  /** Exact amount as a decimal string, for any further server-side maths. */
  priceValue: string;
  compareAtLabel: string | null;
  discountPercent: number | null;
  shortDescription: string | null;
  categoryName: string;
  categorySlug: string;
  badge: string | null;
  toneHex: string | null;
  isFeatured: boolean;
  isBestseller: boolean;
  inStock: boolean;
  isLowStock: boolean;
  image: ProductImageDTO | null;
};

export type CategoryDTO = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  toneHex: string | null;
  imagePath: string | null;
  productCount: number;
};

type ProductRow = Product & {
  category: Pick<Category, "name" | "slug">;
  images: ProductImage[];
};

export function toProductDTO(product: ProductRow, currencySymbol = "Rs."): ProductDTO {
  const primary =
    product.images.find((image) => image.isPrimary) ?? product.images[0] ?? null;

  return {
    id: product.id,
    slug: product.slug,
    sku: product.sku,
    name: product.name,
    priceLabel: formatWith(product.price, currencySymbol),
    priceValue: toMoneyString(product.price),
    compareAtLabel: product.compareAtPrice
      ? formatWith(product.compareAtPrice, currencySymbol)
      : null,
    discountPercent: discountPercent(product.price, product.compareAtPrice),
    shortDescription: product.shortDescription,
    categoryName: product.category.name,
    categorySlug: product.category.slug,
    badge: product.badge,
    toneHex: product.toneHex,
    isFeatured: product.isFeatured,
    isBestseller: product.isBestseller,
    // Derived, never stored — a stored copy is one more thing to drift.
    inStock: !product.trackInventory || product.stockQuantity > 0,
    isLowStock:
      product.trackInventory &&
      product.stockQuantity > 0 &&
      product.stockQuantity <= product.lowStockThreshold,
    image: primary
      ? {
          src: resolveImageSrc(primary.storagePath),
          alt: primary.altText,
          width: primary.width,
          height: primary.height,
          objectPosition: primary.objectPosition,
        }
      : null,
  };
}

export function toCategoryDTO(
  category: Category & { _count?: { products: number } },
): CategoryDTO {
  return {
    id: category.id,
    slug: category.slug,
    name: category.name,
    description: category.description,
    toneHex: category.toneHex,
    imagePath: category.imagePath,
    productCount: category._count?.products ?? 0,
  };
}

function formatWith(value: Parameters<typeof toMoneyString>[0], symbol: string) {
  // Re-implemented here rather than importing formatMoney so the DTO layer
  // stays the only module that decides presentation for client components.
  const amount = Number(toMoneyString(value));
  return `${symbol} ${new Intl.NumberFormat("en-US").format(Math.round(amount))}`;
}

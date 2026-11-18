import type { Category, Prisma } from "@prisma/client";

import { discountPercent, toMoneyString } from "@/lib/money";
import { resolveImageSrc } from "@/lib/storage/resolve";
import { variantLabel, type SpecRow } from "@/lib/variants";

/**
 * Serialisable shapes for crossing into client components.
 *
 * Prisma rows cannot cross that boundary: `Decimal` is a class instance and
 * React throws "Only plain objects can be passed". Mapping through here is the
 * single place that conversion happens, and money becomes a STRING rather than
 * a number so the float hazard cannot sneak back in.
 *
 * Everything a customer sees about a variant — price, struck-through price,
 * discount percentage, stock, photos, specifications — is computed here, from
 * that variant's own row, so selecting a variant can swap the whole picture
 * without the browser doing any pricing of its own.
 */

// ───────────────────────────── query shapes ─────────────────────────────

/** What a catalogue card needs: shared photos plus each active variant. */
export const CARD_INCLUDE = {
  category: { select: { name: true, slug: true } },
  images: { where: { variantId: null }, orderBy: { sortOrder: "asc" } },
  variants: {
    where: { isActive: true },
    orderBy: [{ isDefault: "desc" }, { sortOrder: "asc" }],
    include: { images: { orderBy: { sortOrder: "asc" } } },
  },
} satisfies Prisma.ProductInclude;

/** Everything the product page needs. */
export const DETAIL_INCLUDE = {
  category: { select: { name: true, slug: true } },
  images: { where: { variantId: null }, orderBy: { sortOrder: "asc" } },
  attributes: {
    orderBy: { sortOrder: "asc" },
    include: { values: { orderBy: { sortOrder: "asc" } } },
  },
  specifications: { orderBy: { sortOrder: "asc" } },
  variants: {
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: {
      images: { orderBy: { sortOrder: "asc" } },
      options: true,
    },
  },
} satisfies Prisma.ProductInclude;

type CardRow = Prisma.ProductGetPayload<{ include: typeof CARD_INCLUDE }>;
type DetailRow = Prisma.ProductGetPayload<{ include: typeof DETAIL_INCLUDE }>;
type VariantRow = CardRow["variants"][number];
type ImageRow = CardRow["images"][number];

// ───────────────────────────── types ─────────────────────────────

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
  type: "SIMPLE" | "VARIABLE";
  /** The lowest variant price, formatted, e.g. "Rs. 24,900". */
  priceLabel: string;
  /** Exact lowest price as a decimal string. */
  priceValue: string;
  /** True when the variants are not all the same price — render "From …". */
  priceIsFrom: boolean;
  compareAtLabel: string | null;
  discountPercent: number | null;
  shortDescription: string | null;
  categoryName: string;
  categorySlug: string;
  badge: string | null;
  toneHex: string | null;
  isFeatured: boolean;
  isBestseller: boolean;
  /** True if at least one active variant can be bought. */
  inStock: boolean;
  isLowStock: boolean;
  variantCount: number;
  /** What the card's quick-add button adds (simple products only). */
  defaultVariantId: string | null;
  image: ProductImageDTO | null;
};

export type SpecDTO = SpecRow;

export type AttributeDTO = {
  id: string;
  name: string;
  display: "BUTTONS" | "SWATCHES";
  values: { id: string; value: string; swatchHex: string | null }[];
};

export type VariantDTO = {
  id: string;
  sku: string;
  /** "Black / Leather" — empty for a simple product. */
  label: string;
  /** attributeId → valueId, which is how the selector finds a variant. */
  options: Record<string, string>;
  priceLabel: string;
  priceValue: string;
  compareAtLabel: string | null;
  discountPercent: number | null;
  inStock: boolean;
  isLowStock: boolean;
  /** Units on hand, or null when stock is not tracked for this variant. */
  stock: number | null;
  /** The most one order can take: stock if tracked, else the per-line cap. */
  maxQty: number;
  isDefault: boolean;
  images: ProductImageDTO[];
  specs: SpecDTO[];
};

export type ProductDetailDTO = ProductDTO & {
  description: string | null;
  imageLift: boolean;
  imageObjectPosition: string | null;
  attributes: AttributeDTO[];
  variants: VariantDTO[];
  /** Shared gallery, shown for any variant that has no photos of its own. */
  images: ProductImageDTO[];
  specs: SpecDTO[];
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

/** The per-line cap in the checkout schema; also the cap for untracked stock. */
export const MAX_LINE_QTY = 99;

// ───────────────────────────── mappers ─────────────────────────────

function imageDTO(image: ImageRow): ProductImageDTO {
  return {
    src: resolveImageSrc(image.storagePath),
    alt: image.altText,
    width: image.width,
    height: image.height,
    objectPosition: image.objectPosition,
  };
}

const primaryOf = <T extends { isPrimary: boolean }>(images: T[]): T | null =>
  images.find((image) => image.isPrimary) ?? images[0] ?? null;

function stockState(variant: { trackInventory: boolean; stockQuantity: number; lowStockThreshold: number }) {
  const inStock = !variant.trackInventory || variant.stockQuantity > 0;
  return {
    inStock,
    isLowStock:
      variant.trackInventory &&
      variant.stockQuantity > 0 &&
      variant.stockQuantity <= variant.lowStockThreshold,
    stock: variant.trackInventory ? variant.stockQuantity : null,
    maxQty: variant.trackInventory
      ? Math.min(MAX_LINE_QTY, Math.max(0, variant.stockQuantity))
      : MAX_LINE_QTY,
  };
}

export function toProductDTO(product: CardRow, currencySymbol = "Rs."): ProductDTO {
  const variants = product.variants;

  // The cheapest variant sets the "From" price and supplies the discount shown
  // on the card; ties go to the default variant because the query orders it first.
  const cheapest = variants.reduce<VariantRow | null>(
    (best, variant) => (!best || variant.price.lt(best.price) ? variant : best),
    null,
  );
  const prices = new Set(variants.map((v) => toMoneyString(v.price)));

  const shared = primaryOf(product.images);
  // A product with no shared photo borrows its cheapest variant's, then any.
  const fallback =
    primaryOf(cheapest?.images ?? []) ?? primaryOf(variants.flatMap((v) => v.images));
  const image = shared ?? fallback;

  const priceValue = cheapest ? toMoneyString(cheapest.price) : toMoneyString(product.minPrice);
  const defaultVariant = variants.find((v) => v.isDefault) ?? variants[0] ?? null;
  const anyInStock = variants.some((v) => stockState(v).inStock);

  return {
    id: product.id,
    slug: product.slug,
    sku: product.sku,
    name: product.name,
    type: product.type,
    priceLabel: formatWith(priceValue, currencySymbol),
    priceValue,
    priceIsFrom: prices.size > 1,
    compareAtLabel: cheapest?.compareAtPrice
      ? formatWith(cheapest.compareAtPrice, currencySymbol)
      : null,
    discountPercent: cheapest ? discountPercent(cheapest.price, cheapest.compareAtPrice) : null,
    shortDescription: product.shortDescription,
    categoryName: product.category.name,
    categorySlug: product.category.slug,
    badge: product.badge,
    toneHex: product.toneHex,
    isFeatured: product.isFeatured,
    isBestseller: product.isBestseller,
    inStock: anyInStock,
    // "Low stock" only means something when there is a single stock figure.
    isLowStock: product.type === "SIMPLE" && !!defaultVariant && stockState(defaultVariant).isLowStock,
    variantCount: variants.length,
    defaultVariantId: product.type === "SIMPLE" ? (defaultVariant?.id ?? null) : null,
    image: image ? imageDTO(image) : null,
  };
}

export function toProductDetailDTO(
  product: DetailRow,
  currencySymbol = "Rs.",
): ProductDetailDTO {
  const card = toProductDTO(product, currencySymbol);

  const attributes: AttributeDTO[] = product.attributes.map((attribute) => ({
    id: attribute.id,
    name: attribute.name,
    display: attribute.display,
    values: attribute.values.map((value) => ({
      id: value.id,
      value: value.value,
      swatchHex: value.swatchHex,
    })),
  }));

  // Attribute order defines how a variant is named: "Colour / Upholstery".
  const attributeOrder = new Map(product.attributes.map((a, index) => [a.id, index]));
  const valueText = new Map(
    product.attributes.flatMap((a) => a.values.map((v) => [v.id, v.value] as const)),
  );
  const attributeName = new Map(product.attributes.map((a) => [a.id, a.name]));

  const productSpecs: SpecDTO[] = product.specifications
    .filter((spec) => spec.variantId === null)
    .map((spec) => ({ group: spec.groupName, name: spec.name, value: spec.value }));

  const variants: VariantDTO[] = product.variants.map((variant) => {
    const ordered = [...variant.options].sort(
      (a, b) => (attributeOrder.get(a.attributeId) ?? 0) - (attributeOrder.get(b.attributeId) ?? 0),
    );
    return {
      id: variant.id,
      sku: variant.sku,
      label: variantLabel(
        ordered.map((o) => ({
          name: attributeName.get(o.attributeId) ?? "",
          value: valueText.get(o.valueId) ?? "",
        })),
      ),
      options: Object.fromEntries(variant.options.map((o) => [o.attributeId, o.valueId])),
      priceLabel: formatWith(variant.price, currencySymbol),
      priceValue: toMoneyString(variant.price),
      compareAtLabel: variant.compareAtPrice
        ? formatWith(variant.compareAtPrice, currencySymbol)
        : null,
      // Derived from the two prices, never stored, so it cannot go stale.
      discountPercent: discountPercent(variant.price, variant.compareAtPrice),
      ...stockState(variant),
      isDefault: variant.isDefault,
      images: variant.images.map(imageDTO),
      specs: product.specifications
        .filter((spec) => spec.variantId === variant.id)
        .map((spec) => ({ group: spec.groupName, name: spec.name, value: spec.value })),
    };
  });

  return {
    ...card,
    description: product.description,
    imageLift: product.imageLift,
    imageObjectPosition: product.imageObjectPosition,
    attributes,
    variants,
    images: product.images.map(imageDTO),
    specs: productSpecs,
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

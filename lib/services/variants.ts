import "server-only";

import type { Prisma } from "@prisma/client";

import { toDecimal } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { buildVariantSku, cartesian, isHexColour, signature } from "@/lib/variants";

/**
 * Variant management — options, combination generation and the price summary.
 *
 * Variants are the source of truth for price and stock. Everything a customer
 * or an order reads comes from them, so the rules that keep them coherent live
 * here rather than being re-derived in each form action.
 */

/** A failure with a message an administrator can act on. */
export class CatalogError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CatalogError";
  }
}

type Tx = Prisma.TransactionClient;

/** Combinations beyond this are almost always a mistake (5 × 5 × 5 × 5). */
export const MAX_VARIANTS = 150;
const MAX_ATTRIBUTES = 5;
const MAX_VALUES = 30;

// ───────────────────────────── price summary ─────────────────────────────

/**
 * Keeps `Product.minPrice` equal to the cheapest active variant.
 *
 * minPrice exists only so the shop can ORDER BY price and print "From Rs. X";
 * the variants stay authoritative. Call this from every code path that adds,
 * removes, reprices or (de)activates a variant — it is cheap and idempotent.
 */
export async function syncProductSummary(tx: Tx, productId: string): Promise<void> {
  const active = await tx.productVariant.aggregate({
    where: { productId, isActive: true },
    _min: { price: true },
  });
  const any = active._min.price
    ? active
    : await tx.productVariant.aggregate({ where: { productId }, _min: { price: true } });

  await tx.product.update({
    where: { id: productId },
    data: { minPrice: any._min.price ?? 0 },
  });
}

/**
 * Exactly one active variant is the default. The default is what the product
 * page preselects, so a product with variants but no default would open on a
 * blank selector.
 */
export async function ensureDefaultVariant(tx: Tx, productId: string): Promise<void> {
  const variants = await tx.productVariant.findMany({
    where: { productId, isActive: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, isDefault: true, stockQuantity: true, trackInventory: true },
  });
  if (variants.length === 0) return;

  const defaults = variants.filter((variant) => variant.isDefault);
  if (defaults.length === 1) return;

  // Prefer one a customer can actually buy, so the page does not open on
  // "out of stock" when a sibling is available.
  const chosen =
    defaults[0] ??
    variants.find((v) => !v.trackInventory || v.stockQuantity > 0) ??
    variants[0];

  await tx.productVariant.updateMany({
    where: { productId, id: { not: chosen.id } },
    data: { isDefault: false },
  });
  await tx.productVariant.update({ where: { id: chosen.id }, data: { isDefault: true } });
}

// ───────────────────────────── history checks ─────────────────────────────

/**
 * A variant that has ever held stock or been ordered cannot be deleted: the
 * ledger's foreign key is RESTRICT by design, and order lines must keep a
 * stable reference. Such a variant is deactivated instead.
 */
async function hasHistory(tx: Tx, variantId: string): Promise<boolean> {
  const [lines, movements] = await Promise.all([
    tx.orderItem.count({ where: { variantId } }),
    tx.inventoryTransaction.count({ where: { variantId } }),
  ]);
  return lines > 0 || movements > 0;
}

/** Storage keys of a variant's uploaded photos, for cleanup after commit. */
async function uploadedPaths(tx: Tx, variantId: string): Promise<string[]> {
  const images = await tx.productImage.findMany({
    where: { variantId },
    select: { storagePath: true },
  });
  // A path starting with "/" is a committed asset under /public, not an upload.
  return images.map((i) => i.storagePath).filter((path) => !path.startsWith("/"));
}

export async function removeOrDeactivateVariant(
  tx: Tx,
  variantId: string,
): Promise<{ action: "deleted" | "deactivated"; orphanedPaths: string[] }> {
  if (await hasHistory(tx, variantId)) {
    await tx.productVariant.update({
      where: { id: variantId },
      data: { isActive: false, isDefault: false },
    });
    return { action: "deactivated", orphanedPaths: [] };
  }
  const orphanedPaths = await uploadedPaths(tx, variantId);
  await tx.productVariant.delete({ where: { id: variantId } });
  return { action: "deleted", orphanedPaths };
}

// ───────────────────────────── attributes ─────────────────────────────

export type AttributeInput = {
  id?: string;
  name: string;
  display: "BUTTONS" | "SWATCHES";
  values: { id?: string; value: string; swatchHex?: string | null }[];
};

/**
 * Replaces a product's option definitions with the submitted ones.
 *
 * Renames and reordering are free. Removing an attribute or value that a
 * variant still uses is refused with the count, because deleting it would
 * leave that variant silently missing one of its own options.
 */
export async function saveAttributes(
  tx: Tx,
  productId: string,
  inputs: AttributeInput[],
): Promise<void> {
  if (inputs.length > MAX_ATTRIBUTES) {
    throw new CatalogError(`A product can have at most ${MAX_ATTRIBUTES} options.`);
  }

  // ---- validate the submission before touching anything ----
  const seenNames = new Set<string>();
  for (const input of inputs) {
    const name = input.name.trim();
    if (!name) throw new CatalogError("Every option needs a name, e.g. Colour or Size.");
    if (seenNames.has(name.toLowerCase())) {
      throw new CatalogError(`“${name}” appears twice. Option names must be different.`);
    }
    seenNames.add(name.toLowerCase());

    if (input.values.length === 0) {
      throw new CatalogError(`“${name}” needs at least one value.`);
    }
    if (input.values.length > MAX_VALUES) {
      throw new CatalogError(`“${name}” has too many values (max ${MAX_VALUES}).`);
    }

    const seenValues = new Set<string>();
    for (const value of input.values) {
      const text = value.value.trim();
      if (!text) throw new CatalogError(`“${name}” has an empty value.`);
      if (seenValues.has(text.toLowerCase())) {
        throw new CatalogError(`“${name}” lists “${text}” twice.`);
      }
      seenValues.add(text.toLowerCase());
      if (value.swatchHex && !isHexColour(value.swatchHex)) {
        throw new CatalogError(`“${text}” needs a colour like #1F1B18.`);
      }
    }
  }

  const existing = await tx.productAttribute.findMany({
    where: { productId },
    include: { values: { include: { _count: { select: { options: true } } } } },
  });

  // ---- removals, guarded by usage ----
  const keepAttributeIds = new Set(inputs.flatMap((i) => (i.id ? [i.id] : [])));
  for (const attribute of existing) {
    if (!keepAttributeIds.has(attribute.id)) {
      const used = attribute.values.reduce((sum, v) => sum + v._count.options, 0);
      if (used > 0) {
        throw new CatalogError(
          `“${attribute.name}” is used by existing variants. Delete those variants first.`,
        );
      }
      await tx.productAttribute.delete({ where: { id: attribute.id } });
    }
  }

  // ---- upserts ----
  for (const [index, input] of inputs.entries()) {
    const name = input.name.trim();
    const current = input.id ? existing.find((a) => a.id === input.id) : undefined;

    const attribute = current
      ? await tx.productAttribute.update({
          where: { id: current.id },
          data: { name, display: input.display, sortOrder: index },
        })
      : await tx.productAttribute.create({
          data: { productId, name, display: input.display, sortOrder: index },
        });

    const keepValueIds = new Set(input.values.flatMap((v) => (v.id ? [v.id] : [])));
    for (const value of current?.values ?? []) {
      if (!keepValueIds.has(value.id)) {
        if (value._count.options > 0) {
          throw new CatalogError(
            `“${value.value}” is used by ${value._count.options} variant${
              value._count.options === 1 ? "" : "s"
            }. Delete ${value._count.options === 1 ? "it" : "them"} first.`,
          );
        }
        await tx.productAttributeValue.delete({ where: { id: value.id } });
      }
    }

    for (const [valueIndex, value] of input.values.entries()) {
      const data = {
        value: value.value.trim(),
        swatchHex: input.display === "SWATCHES" ? value.swatchHex || null : null,
        sortOrder: valueIndex,
      };
      const known = value.id && current?.values.some((v) => v.id === value.id);
      if (known) {
        await tx.productAttributeValue.update({ where: { id: value.id! }, data });
      } else {
        await tx.productAttributeValue.create({
          data: { ...data, attributeId: attribute.id },
        });
      }
    }
  }
}

// ───────────────────────────── generation ─────────────────────────────

type Plan = {
  /** Combinations that do not exist yet. */
  toCreate: { valueIds: string[]; values: string[] }[];
  /** Existing variants whose combination is no longer in the option matrix. */
  stale: { id: string; sku: string; hasHistory: boolean }[];
  /** Existing variants that already match a combination. */
  kept: number;
  total: number;
};

async function loadMatrix(tx: Tx, productId: string) {
  const product = await tx.product.findUnique({
    where: { id: productId },
    select: {
      sku: true,
      type: true,
      attributes: {
        orderBy: { sortOrder: "asc" },
        include: { values: { orderBy: { sortOrder: "asc" } } },
      },
    },
  });
  if (!product) throw new CatalogError("That product no longer exists.");
  return product;
}

/** What generation would do, without doing it — drives the button's label. */
export async function planGeneration(productId: string): Promise<Plan | null> {
  return prisma.$transaction(async (tx) => {
    const product = await loadMatrix(tx, productId);
    if (product.type !== "VARIABLE") return null;
    if (
      product.attributes.length === 0 ||
      product.attributes.some((a) => a.values.length === 0)
    ) {
      return null;
    }
    return computePlan(tx, productId, product.attributes);
  });
}

async function computePlan(
  tx: Tx,
  productId: string,
  attributes: Awaited<ReturnType<typeof loadMatrix>>["attributes"],
): Promise<Plan> {
  const combos = cartesian(attributes.map((attribute) => attribute.values));

  const variants = await tx.productVariant.findMany({
    where: { productId },
    select: { id: true, sku: true, options: { select: { valueId: true } } },
  });

  const bySignature = new Map(
    variants.map((variant) => [signature(variant.options.map((o) => o.valueId)), variant]),
  );
  const targetSignatures = new Set<string>();
  const toCreate: Plan["toCreate"] = [];
  let kept = 0;

  for (const combo of combos) {
    const valueIds = combo.map((value) => value.id);
    const key = signature(valueIds);
    targetSignatures.add(key);
    if (bySignature.has(key)) kept += 1;
    else toCreate.push({ valueIds, values: combo.map((value) => value.value) });
  }

  const stale: Plan["stale"] = [];
  for (const variant of variants) {
    if (!targetSignatures.has(signature(variant.options.map((o) => o.valueId)))) {
      stale.push({ id: variant.id, sku: variant.sku, hasHistory: await hasHistory(tx, variant.id) });
    }
  }

  return { toCreate, stale, kept, total: combos.length };
}

export type GenerationResult = {
  created: number;
  removed: number;
  deactivated: number;
  kept: number;
  orphanedPaths: string[];
};

/**
 * Brings the variant list in line with the option matrix.
 *
 * Existing variants that still match keep everything — price, stock, images,
 * SKU. Missing combinations are created. Variants whose combination no longer
 * exists are deleted when they have no history and deactivated when they do,
 * so regenerating never destroys an order's reference.
 */
export async function generateVariants(
  tx: Tx,
  productId: string,
  { defaultPrice }: { defaultPrice?: string } = {},
): Promise<GenerationResult> {
  const product = await loadMatrix(tx, productId);
  if (product.type !== "VARIABLE") {
    throw new CatalogError("Only variable products have generated variants.");
  }
  if (product.attributes.length === 0) {
    throw new CatalogError("Add at least one option (e.g. Colour) first.");
  }
  const empty = product.attributes.find((a) => a.values.length === 0);
  if (empty) throw new CatalogError(`“${empty.name}” has no values yet.`);

  const plan = await computePlan(tx, productId, product.attributes);
  if (plan.total > MAX_VARIANTS) {
    throw new CatalogError(
      `That would create ${plan.total} variants (max ${MAX_VARIANTS}). Remove some option values.`,
    );
  }

  // New variants start at the price of an existing sibling, so adding "Grey"
  // to a chair that sells at 48,500 does not create a Rs. 0 chair. With no
  // sibling to copy, the admin must supply one — a free variant is a bug that
  // customers would find before staff did.
  const sibling = await tx.productVariant.findFirst({
    where: { productId, isActive: true },
    orderBy: { sortOrder: "asc" },
    select: { price: true, compareAtPrice: true, lowStockThreshold: true, trackInventory: true },
  });

  let basePrice = sibling?.price ?? null;
  if (plan.toCreate.length > 0 && !basePrice) {
    const parsed = defaultPrice && /^\d{1,10}(\.\d{1,2})?$/.test(defaultPrice.trim())
      ? toDecimal(defaultPrice.trim())
      : null;
    if (!parsed || parsed.lte(0)) {
      throw new CatalogError("Enter a starting price for the new variants.");
    }
    basePrice = parsed;
  }

  const taken = new Set(
    (
      await tx.productVariant.findMany({
        where: { sku: { startsWith: product.sku } },
        select: { sku: true },
      })
    ).map((v) => v.sku),
  );

  // Remove or deactivate what no longer belongs.
  let removed = 0;
  let deactivated = 0;
  const orphanedPaths: string[] = [];
  for (const variant of plan.stale) {
    const outcome = await removeOrDeactivateVariant(tx, variant.id);
    if (outcome.action === "deleted") removed += 1;
    else deactivated += 1;
    orphanedPaths.push(...outcome.orphanedPaths);
  }

  // Create what is missing.
  for (const combo of plan.toCreate) {
    const sku = buildVariantSku(product.sku, combo.values, taken);
    taken.add(sku);

    const variant = await tx.productVariant.create({
      data: {
        productId,
        sku,
        price: basePrice!,
        compareAtPrice: sibling?.compareAtPrice ?? null,
        stockQuantity: 0,
        lowStockThreshold: sibling?.lowStockThreshold ?? 3,
        trackInventory: sibling?.trackInventory ?? true,
      },
    });
    await tx.variantOption.createMany({
      data: combo.valueIds.map((valueId, index) => ({
        variantId: variant.id,
        valueId,
        attributeId: product.attributes[index].id,
      })),
    });
  }

  // Order the list the way the option matrix reads.
  const combos = cartesian(product.attributes.map((attribute) => attribute.values));
  const order = new Map(
    combos.map((combo, index) => [signature(combo.map((v) => v.id)), index]),
  );
  const all = await tx.productVariant.findMany({
    where: { productId },
    select: { id: true, options: { select: { valueId: true } } },
  });
  for (const variant of all) {
    const position = order.get(signature(variant.options.map((o) => o.valueId)));
    if (position !== undefined) {
      await tx.productVariant.update({
        where: { id: variant.id },
        data: { sortOrder: position },
      });
    }
  }

  await ensureDefaultVariant(tx, productId);
  await syncProductSummary(tx, productId);

  return {
    created: plan.toCreate.length,
    removed,
    deactivated,
    kept: plan.kept,
    orphanedPaths,
  };
}

// ───────────────────────────── images ─────────────────────────────

/**
 * Exactly one primary image per scope (the shared gallery, or one variant's).
 * Called after any image is added or removed.
 */
export async function normalisePrimaryImage(
  tx: Tx,
  productId: string,
  variantId: string | null,
): Promise<void> {
  const images = await tx.productImage.findMany({
    where: { productId, variantId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, isPrimary: true },
  });
  if (images.length === 0) return;

  const primaries = images.filter((image) => image.isPrimary);
  if (primaries.length === 1) return;

  const keep = primaries[0] ?? images[0];
  await tx.productImage.updateMany({
    where: { productId, variantId, id: { not: keep.id } },
    data: { isPrimary: false },
  });
  await tx.productImage.update({ where: { id: keep.id }, data: { isPrimary: true } });
}

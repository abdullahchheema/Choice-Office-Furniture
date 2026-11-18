"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { InsufficientStockError, adjustStock } from "@/lib/services/inventory";
import {
  CatalogError,
  ensureDefaultVariant,
  generateVariants,
  removeOrDeactivateVariant,
  saveAttributes,
  syncProductSummary,
} from "@/lib/services/variants";
import { storage } from "@/lib/storage";

export type VariantActionState = { error?: string; message?: string };

async function refresh(productId: string) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { slug: true },
  });
  revalidatePath(`/admin/products/${productId}`);
  revalidatePath("/admin/products");
  revalidatePath("/admin/inventory");
  revalidatePath("/shop");
  revalidatePath("/");
  if (product) revalidatePath(`/products/${product.slug}`);
}

/** Storage cleanup happens after the commit, never inside it. */
async function removeFiles(paths: string[]) {
  if (paths.length === 0) return;
  await storage.remove(paths).catch((error) => {
    console.error("[admin] orphaned storage objects", paths, error);
  });
}

function fail(error: unknown, label: string): VariantActionState {
  if (error instanceof CatalogError) return { error: error.message };
  const code = (error as { code?: string })?.code;
  if (code === "P2002") {
    const target = String((error as { meta?: { target?: unknown } })?.meta?.target ?? "");
    if (target.includes("sku")) return { error: "That SKU is already used by another variant." };
    return { error: "Those option names or values collide. Make each one different." };
  }
  console.error(`[admin] ${label} failed`, error);
  return { error: "That did not save. The error has been logged." };
}

// ───────────────────────────── options ─────────────────────────────

const OptionsSchema = z.array(
  z.object({
    id: z.string().optional(),
    name: z.string().trim().min(1).max(60),
    display: z.enum(["BUTTONS", "SWATCHES"]),
    values: z
      .array(
        z.object({
          id: z.string().optional(),
          value: z.string().trim().min(1).max(80),
          swatchHex: z.string().nullable().optional(),
        }),
      )
      .max(30),
  }),
);

export async function saveProductOptions(
  productId: string,
  _previous: VariantActionState,
  formData: FormData,
): Promise<VariantActionState> {
  await requireAdmin();

  let json: unknown;
  try {
    json = JSON.parse(String(formData.get("options") ?? "[]"));
  } catch {
    return { error: "The options could not be read." };
  }
  const parsed = OptionsSchema.safeParse(json);
  if (!parsed.success) return { error: "Every option needs a name and every value some text." };

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { type: true },
  });
  if (!product) return { error: "That product no longer exists." };
  if (product.type !== "VARIABLE") {
    return { error: "Simple products have no options." };
  }

  try {
    await prisma.$transaction((tx) => saveAttributes(tx, productId, parsed.data), {
      timeout: 15_000,
    });
  } catch (error) {
    return fail(error, "save options");
  }

  await refresh(productId);
  return { message: "Options saved. Generate variants to create the combinations." };
}

export async function generateProductVariants(
  productId: string,
  _previous: VariantActionState,
  formData: FormData,
): Promise<VariantActionState> {
  await requireAdmin();

  let result;
  try {
    result = await prisma.$transaction(
      (tx) =>
        generateVariants(tx, productId, {
          defaultPrice: String(formData.get("defaultPrice") ?? ""),
        }),
      { timeout: 30_000, maxWait: 5_000 },
    );
  } catch (error) {
    return fail(error, "generate variants");
  }

  await removeFiles(result.orphanedPaths);
  await refresh(productId);

  const parts = [
    result.created > 0 ? `${result.created} created` : null,
    result.kept > 0 ? `${result.kept} kept as they were` : null,
    result.removed > 0 ? `${result.removed} removed` : null,
    result.deactivated > 0
      ? `${result.deactivated} deactivated (they have order or stock history)`
      : null,
  ].filter(Boolean);
  return { message: parts.length ? `Variants updated — ${parts.join(", ")}.` : "Nothing to change." };
}

// ───────────────────────────── a single variant ─────────────────────────────

const money = (label: string) =>
  z.string().trim().regex(/^\d{1,10}(\.\d{1,2})?$/, `${label} must be a number, e.g. 48500`);

const VariantSchema = z
  .object({
    sku: z.string().trim().min(1, "SKU is required").max(64),
    price: money("Price").refine((v) => Number(v) > 0, "Price must be greater than zero"),
    compareAtPrice: money("Compare-at").optional().or(z.literal("")),
    stockQuantity: z.coerce.number().int().min(0, "Stock cannot be negative").max(1_000_000),
    lowStockThreshold: z.coerce.number().int().min(0).max(10_000),
    trackInventory: z.coerce.boolean(),
    isActive: z.coerce.boolean(),
    isDefault: z.coerce.boolean(),
  })
  .refine((d) => !d.compareAtPrice || Number(d.compareAtPrice) > Number(d.price), {
    message: "Compare-at price must be higher than the price",
    path: ["compareAtPrice"],
  });

export async function updateVariant(
  variantId: string,
  _previous: VariantActionState,
  formData: FormData,
): Promise<VariantActionState> {
  const admin = await requireAdmin();

  const flag = (key: string) => formData.get(key) === "on" || formData.get(key) === "true";
  const parsed = VariantSchema.safeParse({
    sku: formData.get("sku") ?? "",
    price: formData.get("price") ?? "",
    compareAtPrice: formData.get("compareAtPrice") ?? "",
    stockQuantity: formData.get("stockQuantity") ?? "0",
    lowStockThreshold: formData.get("lowStockThreshold") ?? "3",
    trackInventory: flag("trackInventory"),
    isActive: flag("isActive"),
    isDefault: flag("isDefault"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the fields." };
  const data = parsed.data;

  const existing = await prisma.productVariant.findUnique({
    where: { id: variantId },
    select: {
      productId: true,
      stockQuantity: true,
      isActive: true,
      product: { select: { status: true, type: true, sku: true } },
    },
  });
  if (!existing) return { error: "That variant no longer exists." };

  // A simple product's lone variant is edited from the product form, where its
  // SKU is tied to the product's.
  if (existing.product.type === "SIMPLE") {
    return { error: "Edit a simple product's price and stock on the product form." };
  }

  try {
    await prisma.$transaction(
      async (tx) => {
        if (existing.isActive && !data.isActive && existing.product.status === "PUBLISHED") {
          const others = await tx.productVariant.count({
            where: { productId: existing.productId, isActive: true, id: { not: variantId } },
          });
          if (others === 0) {
            throw new CatalogError(
              "A published product needs at least one active variant. Unpublish it first.",
            );
          }
        }

        await tx.productVariant.update({
          where: { id: variantId },
          data: {
            sku: data.sku,
            price: data.price,
            compareAtPrice: data.compareAtPrice || null,
            lowStockThreshold: data.lowStockThreshold,
            trackInventory: data.trackInventory,
            isActive: data.isActive,
            isDefault: data.isActive && data.isDefault,
          },
        });

        // Only one default: choosing this one demotes the rest.
        if (data.isActive && data.isDefault) {
          await tx.productVariant.updateMany({
            where: { productId: existing.productId, id: { not: variantId } },
            data: { isDefault: false },
          });
        }

        const delta = data.stockQuantity - existing.stockQuantity;
        if (delta !== 0) {
          const priorMovements = await tx.inventoryTransaction.count({ where: { variantId } });
          await adjustStock({
            tx,
            variantId,
            delta,
            reason: priorMovements === 0 ? "INITIAL_STOCK" : "MANUAL_ADJUSTMENT",
            note:
              priorMovements === 0
                ? "Opening stock set from the variant form"
                : `Adjusted from the variant form (${existing.stockQuantity} → ${data.stockQuantity})`,
            adminId: admin.id,
          });
        }

        await ensureDefaultVariant(tx, existing.productId);
        await syncProductSummary(tx, existing.productId);
      },
      { timeout: 15_000, maxWait: 5_000 },
    );
  } catch (error) {
    if (error instanceof InsufficientStockError) return { error: error.message };
    return fail(error, "update variant");
  }

  await refresh(existing.productId);
  return { message: "Saved." };
}

export async function deleteVariant(variantId: string): Promise<VariantActionState> {
  await requireAdmin();

  const variant = await prisma.productVariant.findUnique({
    where: { id: variantId },
    select: { productId: true, isActive: true, product: { select: { status: true, type: true } } },
  });
  if (!variant) return {};
  if (variant.product.type === "SIMPLE") {
    return { error: "A simple product's only variant cannot be removed." };
  }

  let outcome;
  try {
    outcome = await prisma.$transaction(async (tx) => {
      if (variant.isActive && variant.product.status === "PUBLISHED") {
        const others = await tx.productVariant.count({
          where: { productId: variant.productId, isActive: true, id: { not: variantId } },
        });
        if (others === 0) {
          throw new CatalogError(
            "A published product needs at least one active variant. Unpublish it first.",
          );
        }
      }
      const result = await removeOrDeactivateVariant(tx, variantId);
      await ensureDefaultVariant(tx, variant.productId);
      await syncProductSummary(tx, variant.productId);
      return result;
    });
  } catch (error) {
    return fail(error, "delete variant");
  }

  await removeFiles(outcome.orphanedPaths);
  await refresh(variant.productId);
  return {
    message:
      outcome.action === "deleted"
        ? "Variant deleted."
        : "This variant has order or stock history, so it was deactivated instead of deleted.",
  };
}

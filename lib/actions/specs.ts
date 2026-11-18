"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";

export type SpecState = { error?: string; message?: string };

const SpecRows = z
  .array(
    z.object({
      group: z.string().trim().max(60).optional().nullable(),
      name: z.string().trim().max(80),
      value: z.string().trim().max(400),
    }),
  )
  .max(80);

/**
 * Replaces the specification list of one scope — the whole product, or one
 * variant. Replace-all inside a transaction keeps the editor simple (rows can
 * be added, reordered, renamed or removed freely) without per-row diffing.
 */
export async function saveSpecifications(
  productId: string,
  variantId: string | null,
  _previous: SpecState,
  formData: FormData,
): Promise<SpecState> {
  await requireAdmin();

  let json: unknown;
  try {
    json = JSON.parse(String(formData.get("specs") ?? "[]"));
  } catch {
    return { error: "The specifications could not be read." };
  }
  const parsed = SpecRows.safeParse(json);
  if (!parsed.success) return { error: "A specification label or value is too long." };

  // Blank rows are the editor's spare line, not data.
  const rows = parsed.data.filter((row) => row.name || row.value);

  const seen = new Set<string>();
  for (const row of rows) {
    if (!row.name) return { error: "Every specification needs a label." };
    if (!row.value) return { error: `“${row.name}” needs a value.` };
    const key = row.name.toLowerCase();
    if (seen.has(key)) {
      return { error: `“${row.name}” is listed twice. Combine them or rename one.` };
    }
    seen.add(key);
  }

  if (variantId) {
    const variant = await prisma.productVariant.findFirst({
      where: { id: variantId, productId },
      select: { id: true },
    });
    if (!variant) return { error: "That variant does not belong to this product." };
  }

  await prisma.$transaction([
    prisma.productSpecification.deleteMany({ where: { productId, variantId } }),
    prisma.productSpecification.createMany({
      data: rows.map((row, index) => ({
        productId,
        variantId,
        groupName: row.group || null,
        name: row.name,
        value: row.value,
        sortOrder: index,
      })),
    }),
  ]);

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { slug: true },
  });
  revalidatePath(`/admin/products/${productId}`);
  if (product) revalidatePath(`/products/${product.slug}`);
  return { message: rows.length === 0 ? "Specifications cleared." : "Specifications saved." };
}

/** The spec names a category usually needs, offered when editing a product. */
export async function saveSpecTemplates(
  categoryId: string,
  _previous: SpecState,
  formData: FormData,
): Promise<SpecState> {
  await requireAdmin();

  let json: unknown;
  try {
    json = JSON.parse(String(formData.get("templates") ?? "[]"));
  } catch {
    return { error: "The templates could not be read." };
  }
  const parsed = z
    .array(
      z.object({
        group: z.string().trim().max(60).optional().nullable(),
        name: z.string().trim().max(80),
      }),
    )
    .max(60)
    .safeParse(json);
  if (!parsed.success) return { error: "A template label is too long." };

  const rows = parsed.data.filter((row) => row.name);
  const names = new Set<string>();
  for (const row of rows) {
    if (names.has(row.name.toLowerCase())) {
      return { error: `“${row.name}” is listed twice.` };
    }
    names.add(row.name.toLowerCase());
  }

  await prisma.$transaction([
    prisma.categorySpecTemplate.deleteMany({ where: { categoryId } }),
    prisma.categorySpecTemplate.createMany({
      data: rows.map((row, index) => ({
        categoryId,
        groupName: row.group || null,
        name: row.name,
        sortOrder: index,
      })),
    }),
  ]);

  revalidatePath("/admin/categories");
  return { message: "Specification template saved." };
}

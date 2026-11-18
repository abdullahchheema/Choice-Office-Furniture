"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { normalisePrimaryImage } from "@/lib/services/variants";
import { storage } from "@/lib/storage";

/*
 * Images live in one of two scopes: the product's shared gallery (variantId
 * null) or one variant's own gallery. Each scope has exactly one primary, and
 * the storefront shows a variant's own images when it has any, falling back to
 * the shared gallery when it does not.
 */

async function refresh(productId: string) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { slug: true },
  });
  revalidatePath(`/admin/products/${productId}`);
  revalidatePath("/shop");
  revalidatePath("/");
  if (product) revalidatePath(`/products/${product.slug}`);
}

export async function deleteProductImage(imageId: string): Promise<void> {
  await requireAdmin();

  const image = await prisma.productImage.findUnique({
    where: { id: imageId },
    select: { id: true, productId: true, variantId: true, storagePath: true },
  });
  if (!image) return;

  await prisma.$transaction(async (tx) => {
    await tx.productImage.delete({ where: { id: imageId } });
    // Promote another image in the same scope so it is never left without a primary.
    await normalisePrimaryImage(tx, image.productId, image.variantId);
  });

  /*
   * Storage is cleaned AFTER the database commits, never inside the
   * transaction: a failed delete here must not roll back the row, and a
   * rolled-back row must not have already destroyed the file. A seeded path
   * under /public is a committed asset, not an uploaded object, so it is left
   * alone.
   */
  if (!image.storagePath.startsWith("/")) {
    await storage.remove([image.storagePath]).catch((error) => {
      console.error("[admin] orphaned storage object", image.storagePath, error);
    });
  }

  await refresh(image.productId);
}

export async function setPrimaryImage(imageId: string): Promise<void> {
  await requireAdmin();

  const image = await prisma.productImage.findUnique({
    where: { id: imageId },
    select: { productId: true, variantId: true },
  });
  if (!image) return;

  await prisma.$transaction([
    // Scoped: demoting "the product's images" must not touch a variant's primary.
    prisma.productImage.updateMany({
      where: { productId: image.productId, variantId: image.variantId },
      data: { isPrimary: false },
    }),
    prisma.productImage.update({ where: { id: imageId }, data: { isPrimary: true } }),
  ]);

  await refresh(image.productId);
}

/** Moves an image one place earlier or later within its own scope. */
export async function moveProductImage(imageId: string, direction: -1 | 1): Promise<void> {
  await requireAdmin();

  const image = await prisma.productImage.findUnique({
    where: { id: imageId },
    select: { productId: true, variantId: true },
  });
  if (!image) return;

  await prisma.$transaction(async (tx) => {
    const scope = await tx.productImage.findMany({
      where: { productId: image.productId, variantId: image.variantId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true },
    });
    const index = scope.findIndex((entry) => entry.id === imageId);
    const target = index + direction;
    if (index === -1 || target < 0 || target >= scope.length) return;

    [scope[index], scope[target]] = [scope[target], scope[index]];
    // Rewriting every position keeps the order dense and tie-free.
    for (const [position, entry] of scope.entries()) {
      await tx.productImage.update({ where: { id: entry.id }, data: { sortOrder: position } });
    }
  });

  await refresh(image.productId);
}

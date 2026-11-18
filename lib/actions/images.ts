"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { storage } from "@/lib/storage";

export async function deleteProductImage(imageId: string): Promise<void> {
  await requireAdmin();

  const image = await prisma.productImage.findUnique({
    where: { id: imageId },
    select: { id: true, productId: true, storagePath: true, isPrimary: true },
  });
  if (!image) return;

  await prisma.productImage.delete({ where: { id: imageId } });

  // Promote another image so a product is never left without a primary.
  if (image.isPrimary) {
    const next = await prisma.productImage.findFirst({
      where: { productId: image.productId },
      orderBy: { sortOrder: "asc" },
      select: { id: true },
    });
    if (next) {
      await prisma.productImage.update({
        where: { id: next.id },
        data: { isPrimary: true },
      });
    }
  }

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

  revalidatePath(`/admin/products/${image.productId}`);
  revalidatePath("/");
}

export async function setPrimaryImage(imageId: string): Promise<void> {
  await requireAdmin();

  const image = await prisma.productImage.findUnique({
    where: { id: imageId },
    select: { productId: true },
  });
  if (!image) return;

  await prisma.$transaction([
    prisma.productImage.updateMany({
      where: { productId: image.productId },
      data: { isPrimary: false },
    }),
    prisma.productImage.update({
      where: { id: imageId },
      data: { isPrimary: true },
    }),
  ]);

  revalidatePath(`/admin/products/${image.productId}`);
  revalidatePath("/");
}

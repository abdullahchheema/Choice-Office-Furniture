"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";

export type CategoryState = { error?: string; saved?: boolean };

const CategorySchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2, "Name is required").max(120),
  slug: z.string().trim().max(120).optional(),
  description: z.string().trim().max(400).optional(),
  toneHex: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Tone must be a hex colour")
    .optional()
    .or(z.literal("")),
  imagePath: z.string().trim().max(400).optional(),
  sortOrder: z.coerce.number().int().min(0).max(999),
  isActive: z.coerce.boolean(),
  showOnHomepage: z.coerce.boolean(),
});

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function saveCategory(
  _previous: CategoryState,
  formData: FormData,
): Promise<CategoryState> {
  await requireAdmin();

  const parsed = CategorySchema.safeParse({
    id: formData.get("id") || undefined,
    name: formData.get("name") ?? "",
    slug: formData.get("slug") ?? "",
    description: formData.get("description") ?? "",
    toneHex: formData.get("toneHex") ?? "",
    imagePath: formData.get("imagePath") ?? "",
    sortOrder: formData.get("sortOrder") ?? 0,
    isActive: formData.get("isActive") === "on",
    showOnHomepage: formData.get("showOnHomepage") === "on",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the details" };
  }

  const data = parsed.data;
  const slug = slugify(data.slug || data.name);
  if (!slug) return { error: "Could not build a slug from that name" };

  const fields = {
    name: data.name,
    slug,
    description: data.description || null,
    toneHex: data.toneHex || null,
    imagePath: data.imagePath || null,
    sortOrder: data.sortOrder,
    isActive: data.isActive,
    showOnHomepage: data.showOnHomepage,
  };

  try {
    if (data.id) {
      await prisma.category.update({ where: { id: data.id }, data: fields });
    } else {
      await prisma.category.create({ data: fields });
    }
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      return { error: "A category already uses that URL slug." };
    }
    console.error("[admin] category write failed", error);
    return { error: "Could not save the category." };
  }

  revalidatePath("/admin/categories");
  revalidatePath("/");
  return { saved: true };
}

export async function deleteCategory(categoryId: string): Promise<void> {
  await requireAdmin();

  /*
   * Product.category is RESTRICT, so the database would reject this anyway.
   * Checking first turns a raw constraint error into something actionable:
   * deactivating hides the category without orphaning its products.
   */
  const count = await prisma.product.count({ where: { categoryId } });
  if (count > 0) {
    await prisma.category.update({
      where: { id: categoryId },
      data: { isActive: false },
    });
  } else {
    await prisma.category.delete({ where: { id: categoryId } });
  }

  revalidatePath("/admin/categories");
  revalidatePath("/");
}

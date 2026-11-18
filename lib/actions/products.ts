"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { adjustStock } from "@/lib/services/inventory";

export type FormState = { error?: string; fieldErrors?: Record<string, string> };

/** Lowercase, hyphenated, no leading/trailing hyphen. */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

const ProductSchema = z
  .object({
    name: z.string().trim().min(2, "Name is required").max(160),
    slug: z.string().trim().max(160).optional(),
    sku: z.string().trim().min(1, "SKU is required").max(64),
    categoryId: z.string().trim().min(1, "Choose a category"),
    shortDescription: z.string().trim().max(320).optional(),
    description: z.string().trim().max(8000).optional(),
    // Money arrives as text and is handed to Prisma as a string, so it becomes
    // a Decimal without ever passing through a JS float.
    price: z
      .string()
      .trim()
      .regex(/^\d{1,10}(\.\d{1,2})?$/, "Price must be a number, e.g. 48500"),
    compareAtPrice: z
      .string()
      .trim()
      .regex(/^\d{1,10}(\.\d{1,2})?$/, "Compare-at must be a number")
      .optional()
      .or(z.literal("")),
    stockQuantity: z.coerce.number().int().min(0).max(1_000_000),
    lowStockThreshold: z.coerce.number().int().min(0).max(10_000),
    trackInventory: z.coerce.boolean(),
    status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
    isFeatured: z.coerce.boolean(),
    isBestseller: z.coerce.boolean(),
    badge: z.string().trim().max(32).optional(),
    toneHex: z
      .string()
      .trim()
      .regex(/^#[0-9a-fA-F]{6}$/, "Tone must be a hex colour like #E8D9C3")
      .optional()
      .or(z.literal("")),
    imageObjectPosition: z.string().trim().max(24).optional(),
    imageLift: z.coerce.boolean(),
    material: z.string().trim().max(160).optional(),
    dimensions: z.string().trim().max(160).optional(),
    warrantyMonths: z.coerce.number().int().min(0).max(600).optional(),
    metaTitle: z.string().trim().max(160).optional(),
    metaDescription: z.string().trim().max(320).optional(),
  })
  .refine(
    (data) =>
      !data.compareAtPrice ||
      Number(data.compareAtPrice) > Number(data.price),
    {
      message: "Compare-at price must be higher than the price",
      path: ["compareAtPrice"],
    },
  );

function readForm(formData: FormData) {
  const get = (key: string) => {
    const value = formData.get(key);
    return typeof value === "string" ? value : undefined;
  };
  const bool = (key: string) => formData.get(key) === "on" || formData.get(key) === "true";

  return {
    name: get("name") ?? "",
    slug: get("slug") ?? "",
    sku: get("sku") ?? "",
    categoryId: get("categoryId") ?? "",
    shortDescription: get("shortDescription") ?? "",
    description: get("description") ?? "",
    price: get("price") ?? "",
    compareAtPrice: get("compareAtPrice") ?? "",
    stockQuantity: get("stockQuantity") ?? "0",
    lowStockThreshold: get("lowStockThreshold") ?? "3",
    trackInventory: bool("trackInventory"),
    status: (get("status") ?? "DRAFT") as "DRAFT" | "PUBLISHED" | "ARCHIVED",
    isFeatured: bool("isFeatured"),
    isBestseller: bool("isBestseller"),
    badge: get("badge") ?? "",
    toneHex: get("toneHex") ?? "",
    imageObjectPosition: get("imageObjectPosition") ?? "",
    imageLift: bool("imageLift"),
    material: get("material") ?? "",
    dimensions: get("dimensions") ?? "",
    warrantyMonths: get("warrantyMonths") || undefined,
    metaTitle: get("metaTitle") ?? "",
    metaDescription: get("metaDescription") ?? "",
  };
}

function toFieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}

function refreshStorefront(slug?: string) {
  revalidatePath("/");
  revalidatePath("/admin/products");
  if (slug) revalidatePath(`/products/${slug}`);
}

export async function createProduct(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  // Re-checked here, not inherited from the page: a Server Action is its own
  // HTTP entry point and the layout's guard does not cover it.
  const admin = await requireAdmin();

  const parsed = ProductSchema.safeParse(readForm(formData));
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error) };

  const data = parsed.data;
  const slug = slugify(data.slug || data.name);
  if (!slug) return { fieldErrors: { slug: "Could not build a slug from that name" } };

  let created;
  try {
    created = await prisma.product.create({
      data: {
        slug,
        sku: data.sku,
        name: data.name,
        shortDescription: data.shortDescription || null,
        description: data.description || null,
        price: data.price,
        compareAtPrice: data.compareAtPrice || null,
        stockQuantity: 0, // set below through the ledger
        lowStockThreshold: data.lowStockThreshold,
        trackInventory: data.trackInventory,
        status: data.status,
        publishedAt: data.status === "PUBLISHED" ? new Date() : null,
        isFeatured: data.isFeatured,
        isBestseller: data.isBestseller,
        badge: data.badge || null,
        toneHex: data.toneHex || null,
        imageObjectPosition: data.imageObjectPosition || null,
        imageLift: data.imageLift,
        material: data.material || null,
        dimensions: data.dimensions || null,
        warrantyMonths: data.warrantyMonths ?? null,
        metaTitle: data.metaTitle || null,
        metaDescription: data.metaDescription || null,
        categoryId: data.categoryId,
      },
    });
  } catch (error) {
    return { error: describeWriteError(error) };
  }

  // Opening stock goes through the ledger so the column and its transactions
  // agree from the first row.
  if (data.stockQuantity > 0) {
    await adjustStock({
      productId: created.id,
      delta: data.stockQuantity,
      reason: "INITIAL_STOCK",
      note: "Opening stock set on creation",
      adminId: admin.id,
    });
  }

  refreshStorefront(slug);
  redirect(`/admin/products/${created.id}?created=1`);
}

export async function updateProduct(
  productId: string,
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const admin = await requireAdmin();

  const parsed = ProductSchema.safeParse(readForm(formData));
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error) };

  const data = parsed.data;
  const slug = slugify(data.slug || data.name);

  const existing = await prisma.product.findUnique({
    where: { id: productId },
    select: { stockQuantity: true, status: true, slug: true },
  });
  if (!existing) return { error: "That product no longer exists." };

  try {
    await prisma.product.update({
      where: { id: productId },
      data: {
        slug,
        sku: data.sku,
        name: data.name,
        shortDescription: data.shortDescription || null,
        description: data.description || null,
        price: data.price,
        compareAtPrice: data.compareAtPrice || null,
        lowStockThreshold: data.lowStockThreshold,
        trackInventory: data.trackInventory,
        status: data.status,
        publishedAt:
          data.status === "PUBLISHED" && existing.status !== "PUBLISHED"
            ? new Date()
            : undefined,
        isFeatured: data.isFeatured,
        isBestseller: data.isBestseller,
        badge: data.badge || null,
        toneHex: data.toneHex || null,
        imageObjectPosition: data.imageObjectPosition || null,
        imageLift: data.imageLift,
        material: data.material || null,
        dimensions: data.dimensions || null,
        warrantyMonths: data.warrantyMonths ?? null,
        metaTitle: data.metaTitle || null,
        metaDescription: data.metaDescription || null,
        categoryId: data.categoryId,
        // stockQuantity is deliberately absent — see below.
      },
    });
  } catch (error) {
    return { error: describeWriteError(error) };
  }

  /*
   * Stock is never written directly from a form. A changed figure becomes a
   * ledger-backed adjustment, so the reconciliation query keeps balancing and
   * there is a record of who changed it and by how much.
   */
  const delta = data.stockQuantity - existing.stockQuantity;
  if (delta !== 0) {
    await adjustStock({
      productId,
      delta,
      reason: "MANUAL_ADJUSTMENT",
      note: `Adjusted from the product form (${existing.stockQuantity} → ${data.stockQuantity})`,
      adminId: admin.id,
    });
  }

  refreshStorefront(slug);
  if (existing.slug !== slug) revalidatePath(`/products/${existing.slug}`);
  return {};
}

export async function setProductStatus(
  productId: string,
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED",
): Promise<void> {
  await requireAdmin();
  const product = await prisma.product.update({
    where: { id: productId },
    data: {
      status,
      publishedAt: status === "PUBLISHED" ? new Date() : undefined,
    },
    select: { slug: true },
  });
  refreshStorefront(product.slug);
}

export async function deleteProduct(productId: string): Promise<void> {
  await requireAdmin();

  /*
   * Hard delete is reserved for products that never carried stock and were
   * never ordered. Anything else is archived: InventoryTransaction.product is
   * RESTRICT, so deleting a stocked product would fail at the database anyway,
   * and order history must keep pointing at something.
   */
  const [movements, orderLines, product] = await Promise.all([
    prisma.inventoryTransaction.count({ where: { productId } }),
    prisma.orderItem.count({ where: { productId } }),
    prisma.product.findUnique({ where: { id: productId }, select: { slug: true } }),
  ]);

  if (movements > 0 || orderLines > 0) {
    await prisma.product.update({
      where: { id: productId },
      data: { status: "ARCHIVED" },
    });
  } else {
    await prisma.productImage.deleteMany({ where: { productId } });
    await prisma.product.delete({ where: { id: productId } });
  }

  refreshStorefront(product?.slug);
  redirect("/admin/products");
}

/** Turns Prisma's constraint codes into something an admin can act on. */
function describeWriteError(error: unknown): string {
  const code = (error as { code?: string })?.code;
  const target = String((error as { meta?: { target?: unknown } })?.meta?.target ?? "");

  if (code === "P2002") {
    if (target.includes("sku")) return "That SKU is already used by another product.";
    if (target.includes("slug")) return "That URL slug is already taken.";
    return "A product with those details already exists.";
  }
  if (code === "P2003") return "That category no longer exists.";

  console.error("[admin] product write failed", error);
  return "Could not save the product. The error has been logged.";
}

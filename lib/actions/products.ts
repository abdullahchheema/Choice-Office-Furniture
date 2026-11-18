"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { adjustStock } from "@/lib/services/inventory";
import { CatalogError, syncProductSummary } from "@/lib/services/variants";
import { storage } from "@/lib/storage";

export type FormState = { error?: string; fieldErrors?: Record<string, string>; saved?: boolean };

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

const money = (label: string) =>
  z
    .string()
    .trim()
    .regex(/^\d{1,10}(\.\d{1,2})?$/, `${label} must be a number, e.g. 48500`);

/** Fields every product has, simple or variable. */
const BaseSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(160),
  slug: z.string().trim().max(160).optional(),
  sku: z.string().trim().min(1, "SKU is required").max(64),
  categoryId: z.string().trim().min(1, "Choose a category"),
  shortDescription: z.string().trim().max(320).optional(),
  description: z.string().trim().max(8000).optional(),
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
  metaTitle: z.string().trim().max(160).optional(),
  metaDescription: z.string().trim().max(320).optional(),
});

/** Commercial fields that belong to the single variant of a simple product. */
const CommerceSchema = z
  .object({
    price: money("Price").refine((v) => Number(v) > 0, "Price must be greater than zero"),
    compareAtPrice: money("Compare-at").optional().or(z.literal("")),
    stockQuantity: z.coerce.number().int().min(0).max(1_000_000),
    lowStockThreshold: z.coerce.number().int().min(0).max(10_000),
    trackInventory: z.coerce.boolean(),
  })
  .refine(
    (data) => !data.compareAtPrice || Number(data.compareAtPrice) > Number(data.price),
    { message: "Compare-at price must be higher than the price", path: ["compareAtPrice"] },
  );

function get(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === "string" ? value : undefined;
}
const bool = (formData: FormData, key: string) =>
  formData.get(key) === "on" || formData.get(key) === "true";

function readBase(formData: FormData) {
  return {
    name: get(formData, "name") ?? "",
    slug: get(formData, "slug") ?? "",
    sku: get(formData, "sku") ?? "",
    categoryId: get(formData, "categoryId") ?? "",
    shortDescription: get(formData, "shortDescription") ?? "",
    description: get(formData, "description") ?? "",
    status: (get(formData, "status") ?? "DRAFT") as "DRAFT" | "PUBLISHED" | "ARCHIVED",
    isFeatured: bool(formData, "isFeatured"),
    isBestseller: bool(formData, "isBestseller"),
    badge: get(formData, "badge") ?? "",
    toneHex: get(formData, "toneHex") ?? "",
    imageObjectPosition: get(formData, "imageObjectPosition") ?? "",
    imageLift: bool(formData, "imageLift"),
    metaTitle: get(formData, "metaTitle") ?? "",
    metaDescription: get(formData, "metaDescription") ?? "",
  };
}

function readCommerce(formData: FormData) {
  return {
    price: get(formData, "price") ?? "",
    compareAtPrice: get(formData, "compareAtPrice") ?? "",
    stockQuantity: get(formData, "stockQuantity") ?? "0",
    lowStockThreshold: get(formData, "lowStockThreshold") ?? "3",
    trackInventory: bool(formData, "trackInventory"),
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
  revalidatePath("/shop");
  revalidatePath("/admin/products");
  revalidatePath("/admin/inventory");
  if (slug) revalidatePath(`/products/${slug}`);
}

function productData(data: z.infer<typeof BaseSchema>, slug: string) {
  return {
    slug,
    sku: data.sku,
    name: data.name,
    shortDescription: data.shortDescription || null,
    description: data.description || null,
    isFeatured: data.isFeatured,
    isBestseller: data.isBestseller,
    badge: data.badge || null,
    toneHex: data.toneHex || null,
    imageObjectPosition: data.imageObjectPosition || null,
    imageLift: data.imageLift,
    metaTitle: data.metaTitle || null,
    metaDescription: data.metaDescription || null,
    categoryId: data.categoryId,
  };
}

export async function createProduct(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  // Re-checked here, not inherited from the page: a Server Action is its own
  // HTTP entry point and the layout's guard does not cover it.
  const admin = await requireAdmin();

  const type = get(formData, "type") === "VARIABLE" ? "VARIABLE" : "SIMPLE";

  const base = BaseSchema.safeParse(readBase(formData));
  const commerce = type === "SIMPLE" ? CommerceSchema.safeParse(readCommerce(formData)) : null;

  const fieldErrors: Record<string, string> = {
    ...(base.success ? {} : toFieldErrors(base.error)),
    ...(commerce && !commerce.success ? toFieldErrors(commerce.error) : {}),
  };
  if (!base.success || (commerce && !commerce.success)) return { fieldErrors };

  const data = base.data;
  const slug = slugify(data.slug || data.name);
  if (!slug) return { fieldErrors: { slug: "Could not build a slug from that name" } };

  // A variable product has no variants yet, so it cannot go live; options and
  // variants are added on the next screen.
  const status = type === "VARIABLE" ? "DRAFT" : data.status;

  let createdId: string;
  try {
    createdId = await prisma.$transaction(
      async (tx) => {
        const product = await tx.product.create({
          data: {
            ...productData(data, slug),
            type,
            status,
            publishedAt: status === "PUBLISHED" ? new Date() : null,
          },
        });

        if (type === "SIMPLE" && commerce?.success) {
          const c = commerce.data;
          const variant = await tx.productVariant.create({
            data: {
              productId: product.id,
              sku: data.sku,
              price: c.price,
              compareAtPrice: c.compareAtPrice || null,
              lowStockThreshold: c.lowStockThreshold,
              trackInventory: c.trackInventory,
              isDefault: true,
              stockQuantity: 0, // set through the ledger just below
            },
          });
          // Opening stock goes through the ledger so the column and its
          // transactions agree from the first row.
          if (c.stockQuantity > 0) {
            await adjustStock({
              tx,
              variantId: variant.id,
              delta: c.stockQuantity,
              reason: "INITIAL_STOCK",
              note: "Opening stock set on creation",
              adminId: admin.id,
            });
          }
          await syncProductSummary(tx, product.id);
        }
        return product.id;
      },
      { timeout: 15_000, maxWait: 5_000 },
    );
  } catch (error) {
    return { error: describeWriteError(error) };
  }

  refreshStorefront(slug);
  redirect(`/admin/products/${createdId}?created=1`);
}

export async function updateProduct(
  productId: string,
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const admin = await requireAdmin();

  const existing = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      status: true,
      slug: true,
      type: true,
      sku: true,
      variants: { where: { isDefault: true }, take: 1, select: { id: true, stockQuantity: true } },
      _count: { select: { variants: { where: { isActive: true } } } },
    },
  });
  if (!existing) return { error: "That product no longer exists." };

  const base = BaseSchema.safeParse(readBase(formData));
  const commerce =
    existing.type === "SIMPLE" ? CommerceSchema.safeParse(readCommerce(formData)) : null;

  const fieldErrors: Record<string, string> = {
    ...(base.success ? {} : toFieldErrors(base.error)),
    ...(commerce && !commerce.success ? toFieldErrors(commerce.error) : {}),
  };
  if (!base.success || (commerce && !commerce.success)) return { fieldErrors };

  const data = base.data;
  const slug = slugify(data.slug || data.name);
  if (!slug) return { fieldErrors: { slug: "Could not build a slug from that name" } };

  if (data.status === "PUBLISHED" && existing._count.variants === 0) {
    return {
      fieldErrors: {
        status: "Add at least one active variant before publishing this product.",
      },
    };
  }

  try {
    await prisma.$transaction(
      async (tx) => {
        await tx.product.update({
          where: { id: productId },
          data: {
            ...productData(data, slug),
            status: data.status,
            publishedAt:
              data.status === "PUBLISHED" && existing.status !== "PUBLISHED"
                ? new Date()
                : undefined,
          },
        });

        if (existing.type === "SIMPLE" && commerce?.success) {
          const c = commerce.data;
          const variant = existing.variants[0];
          if (!variant) throw new CatalogError("This product has lost its default variant.");

          await tx.productVariant.update({
            where: { id: variant.id },
            data: {
              // A simple product's variant always shares the product's SKU.
              sku: data.sku,
              price: c.price,
              compareAtPrice: c.compareAtPrice || null,
              lowStockThreshold: c.lowStockThreshold,
              trackInventory: c.trackInventory,
            },
          });

          /*
           * Stock is never written directly from a form. A changed figure
           * becomes a ledger-backed adjustment, so the reconciliation query
           * keeps balancing and there is a record of who changed it.
           */
          const delta = c.stockQuantity - variant.stockQuantity;
          if (delta !== 0) {
            await adjustStock({
              tx,
              variantId: variant.id,
              delta,
              reason: "MANUAL_ADJUSTMENT",
              note: `Adjusted from the product form (${variant.stockQuantity} → ${c.stockQuantity})`,
              adminId: admin.id,
            });
          }
          await syncProductSummary(tx, productId);
        }
      },
      { timeout: 15_000, maxWait: 5_000 },
    );
  } catch (error) {
    if (error instanceof CatalogError) return { error: error.message };
    return { error: describeWriteError(error) };
  }

  refreshStorefront(slug);
  if (existing.slug !== slug) revalidatePath(`/products/${existing.slug}`);
  revalidatePath(`/admin/products/${productId}`);
  return { saved: true };
}

export async function setProductStatus(
  productId: string,
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED",
): Promise<void> {
  await requireAdmin();

  if (status === "PUBLISHED") {
    const active = await prisma.productVariant.count({ where: { productId, isActive: true } });
    if (active === 0) return; // nothing sellable to publish
  }

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
   * Hard delete is reserved for products none of whose variants ever carried
   * stock or were ordered. Anything else is archived: the ledger's foreign key
   * to a variant is RESTRICT, so deleting would fail at the database anyway,
   * and order history must keep pointing at something.
   */
  const [movements, orderLines, product] = await Promise.all([
    prisma.inventoryTransaction.count({ where: { variant: { productId } } }),
    prisma.orderItem.count({ where: { OR: [{ productId }, { variant: { productId } }] } }),
    prisma.product.findUnique({ where: { id: productId }, select: { slug: true } }),
  ]);

  if (movements > 0 || orderLines > 0) {
    await prisma.product.update({ where: { id: productId }, data: { status: "ARCHIVED" } });
  } else {
    const images = await prisma.productImage.findMany({
      where: { productId },
      select: { storagePath: true },
    });
    /*
     * Variants first, then the product, in one transaction. A variant's option
     * rows reference the product's attributes with RESTRICT, and a cascade from
     * the product would try to remove the attributes before those option rows
     * were gone and trip it. Deleting the variants first lets their options
     * cascade away, after which the product (and its attributes) go cleanly.
     */
    await prisma.$transaction([
      prisma.productVariant.deleteMany({ where: { productId } }),
      prisma.product.delete({ where: { id: productId } }),
    ]);

    // After the commit, and never inside it: a failed storage delete must not
    // roll back the row, and a rolled-back row must not have lost its files.
    const uploaded = images.map((i) => i.storagePath).filter((p) => !p.startsWith("/"));
    if (uploaded.length > 0) {
      await storage.remove(uploaded).catch((error) => {
        console.error("[admin] orphaned storage objects", uploaded, error);
      });
    }
  }

  refreshStorefront(product?.slug);
  redirect("/admin/products");
}

/** Turns Prisma's constraint codes into something an admin can act on. */
function describeWriteError(error: unknown): string {
  const code = (error as { code?: string })?.code;
  const target = String((error as { meta?: { target?: unknown } })?.meta?.target ?? "");

  if (code === "P2002") {
    if (target.includes("sku")) return "That SKU is already used by another product or variant.";
    if (target.includes("slug")) return "That URL slug is already taken.";
    return "A product with those details already exists.";
  }
  if (code === "P2003") return "That category no longer exists.";

  console.error("[admin] product write failed", error);
  return "Could not save the product. The error has been logged.";
}

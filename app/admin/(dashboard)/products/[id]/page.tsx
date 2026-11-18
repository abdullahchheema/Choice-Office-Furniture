import Link from "next/link";
import { notFound } from "next/navigation";

import { ProductImages } from "@/components/admin/ProductImages";
import { ProductForm, type ProductFormValues } from "@/components/admin/ProductForm";
import { deleteProduct, updateProduct } from "@/lib/actions/products";
import { prisma } from "@/lib/prisma";
import { resolveImageSrc } from "@/lib/storage/resolve";
import { getSettingsOrNull } from "@/lib/queries";

export const metadata = { title: "Edit product" };

export default async function EditProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const { id } = await params;
  const { created } = await searchParams;

  const [product, categories, settings, movements, orderLines] = await Promise.all([
    prisma.product.findUnique({
      where: { id },
      include: { images: { orderBy: { sortOrder: "asc" } } },
    }),
    prisma.category.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true },
    }),
    getSettingsOrNull(),
    prisma.inventoryTransaction.count({ where: { productId: id } }),
    prisma.orderItem.count({ where: { productId: id } }),
  ]);

  if (!product) notFound();

  const values: ProductFormValues = {
    name: product.name,
    slug: product.slug,
    sku: product.sku,
    categoryId: product.categoryId,
    shortDescription: product.shortDescription ?? "",
    description: product.description ?? "",
    price: product.price.toString(),
    compareAtPrice: product.compareAtPrice?.toString() ?? "",
    stockQuantity: product.stockQuantity,
    lowStockThreshold: product.lowStockThreshold,
    trackInventory: product.trackInventory,
    status: product.status,
    isFeatured: product.isFeatured,
    isBestseller: product.isBestseller,
    badge: product.badge ?? "",
    toneHex: product.toneHex ?? "",
    imageObjectPosition: product.imageObjectPosition ?? "",
    imageLift: product.imageLift,
    material: product.material ?? "",
    dimensions: product.dimensions ?? "",
    warrantyMonths: product.warrantyMonths?.toString() ?? "",
    metaTitle: product.metaTitle ?? "",
    metaDescription: product.metaDescription ?? "",
  };

  // A product with history is archived, never deleted — the ledger has a
  // RESTRICT foreign key and order lines must keep their reference.
  const hasHistory = movements > 0 || orderLines > 0;
  const removeProduct = deleteProduct.bind(null, product.id);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/admin/products"
            className="text-sm font-semibold text-text-muted hover:text-clay"
          >
            ← Products
          </Link>
          <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-ink">
            {product.name}
          </h1>
          <p className="mt-1 font-mono text-xs text-text-muted">{product.sku}</p>
        </div>
        {product.status === "PUBLISHED" ? (
          <Link
            href={`/products/${product.slug}`}
            className="rounded-full border border-espresso px-4 py-2 text-sm font-bold text-espresso transition-colors hover:bg-espresso hover:text-cream"
          >
            View on the shop
          </Link>
        ) : null}
      </header>

      {created ? (
        <p
          role="status"
          className="rounded-md border border-oak bg-sand/40 px-4 py-3 text-sm text-espresso"
        >
          Product created. Add a photo below, then set the status to Published.
        </p>
      ) : null}

      <ProductImages
        productId={product.id}
        images={product.images.map((image) => ({
          id: image.id,
          src: resolveImageSrc(image.storagePath),
          alt: image.altText,
          isPrimary: image.isPrimary,
        }))}
      />

      <ProductForm
        action={updateProduct.bind(null, product.id)}
        values={values}
        categories={categories}
        currencySymbol={settings?.currencySymbol ?? "Rs."}
        submitLabel="Save changes"
      />

      <section className="rounded-card border border-destructive/25 bg-destructive/[0.03] p-6">
        <h2 className="font-display text-lg font-extrabold text-ink">
          {hasHistory ? "Archive" : "Delete"}
        </h2>
        <p className="mt-1 max-w-prose text-sm text-text-muted">
          {hasHistory
            ? `This product has ${movements} stock movement${
                movements === 1 ? "" : "s"
              } and appears on ${orderLines} order line${
                orderLines === 1 ? "" : "s"
              }, so it is archived rather than deleted. Archiving hides it from the shop while past orders and the stock ledger stay intact.`
            : "This product has never held stock or appeared on an order, so it can be removed completely."}
        </p>
        <form action={removeProduct} className="mt-4">
          <button
            type="submit"
            className="rounded-full border border-destructive px-5 py-2 text-sm font-bold text-destructive transition-colors hover:bg-destructive hover:text-cream"
          >
            {hasHistory ? "Archive product" : "Delete product"}
          </button>
        </form>
      </section>
    </div>
  );
}

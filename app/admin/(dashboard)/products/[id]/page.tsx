import Link from "next/link";
import { notFound } from "next/navigation";

import { OptionsEditor, type GenerationPlan, type OptionAttribute } from "@/components/admin/OptionsEditor";
import { ProductForm, type ProductFormValues } from "@/components/admin/ProductForm";
import { ProductImages } from "@/components/admin/ProductImages";
import { Section } from "@/components/admin/form-bits";
import { SpecsEditor } from "@/components/admin/SpecsEditor";
import { VariantCard } from "@/components/admin/VariantCard";
import { deleteProduct, updateProduct } from "@/lib/actions/products";
import { prisma } from "@/lib/prisma";
import { getSettingsOrNull } from "@/lib/queries";
import { planGeneration } from "@/lib/services/variants";
import { resolveImageSrc } from "@/lib/storage/resolve";
import { variantLabel } from "@/lib/variants";

export const metadata = { title: "Edit product" };

const toImages = (images: { id: string; storagePath: string; altText: string; isPrimary: boolean }[]) =>
  images.map((image) => ({
    id: image.id,
    src: resolveImageSrc(image.storagePath),
    alt: image.altText,
    isPrimary: image.isPrimary,
  }));

export default async function EditProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const { id } = await params;
  const { created } = await searchParams;

  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      images: { where: { variantId: null }, orderBy: { sortOrder: "asc" } },
      attributes: {
        orderBy: { sortOrder: "asc" },
        include: { values: { orderBy: { sortOrder: "asc" } } },
      },
      specifications: { orderBy: { sortOrder: "asc" } },
      variants: {
        orderBy: [{ isActive: "desc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
        include: {
          images: { orderBy: { sortOrder: "asc" } },
          options: { include: { attribute: true, value: true } },
        },
      },
    },
  });
  if (!product) notFound();

  const [categories, settings, templates, movements, orderLines, rawPlan] = await Promise.all([
    prisma.category.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true },
    }),
    getSettingsOrNull(),
    prisma.categorySpecTemplate.findMany({
      where: { categoryId: product.categoryId },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.inventoryTransaction.count({ where: { variant: { productId: id } } }),
    prisma.orderItem.count({ where: { OR: [{ productId: id }, { variant: { productId: id } }] } }),
    product.type === "VARIABLE" ? planGeneration(id) : Promise.resolve(null),
  ]);

  const symbol = settings?.currencySymbol ?? "Rs.";
  const isVariable = product.type === "VARIABLE";
  const defaultVariant = product.variants.find((v) => v.isDefault) ?? product.variants[0];

  const values: ProductFormValues = {
    name: product.name,
    slug: product.slug,
    sku: product.sku,
    categoryId: product.categoryId,
    shortDescription: product.shortDescription ?? "",
    description: product.description ?? "",
    // A simple product's commercial fields live on its one variant.
    price: defaultVariant?.price.toString() ?? "",
    compareAtPrice: defaultVariant?.compareAtPrice?.toString() ?? "",
    stockQuantity: defaultVariant?.stockQuantity ?? 0,
    lowStockThreshold: defaultVariant?.lowStockThreshold ?? 3,
    trackInventory: defaultVariant?.trackInventory ?? true,
    status: product.status,
    isFeatured: product.isFeatured,
    isBestseller: product.isBestseller,
    badge: product.badge ?? "",
    toneHex: product.toneHex ?? "",
    imageObjectPosition: product.imageObjectPosition ?? "",
    imageLift: product.imageLift,
    metaTitle: product.metaTitle ?? "",
    metaDescription: product.metaDescription ?? "",
  };

  const optionAttributes: OptionAttribute[] = product.attributes.map((attribute) => ({
    id: attribute.id,
    name: attribute.name,
    display: attribute.display,
    values: attribute.values.map((value) => ({
      id: value.id,
      value: value.value,
      swatchHex: value.swatchHex ?? "#cccccc",
    })),
  }));

  const plan: GenerationPlan = rawPlan
    ? {
        create: rawPlan.toCreate.length,
        deleteCount: rawPlan.stale.filter((s) => !s.hasHistory).length,
        deactivateCount: rawPlan.stale.filter((s) => s.hasHistory).length,
        kept: rawPlan.kept,
        total: rawPlan.total,
        needsPrice: !product.variants.some((v) => v.isActive),
      }
    : null;

  const attributeOrder = new Map(product.attributes.map((a, i) => [a.id, i]));
  const productSpecs = product.specifications.filter((spec) => spec.variantId === null);
  const specTemplates = templates.map((t) => ({ group: t.groupName, name: t.name }));
  const toRows = (specs: typeof productSpecs) =>
    specs.map((s) => ({ group: s.groupName ?? "", name: s.name, value: s.value }));

  // A product with history is archived, never deleted — the ledger has a
  // RESTRICT foreign key and order lines must keep their reference.
  const hasHistory = movements > 0 || orderLines > 0;
  const removeProduct = deleteProduct.bind(null, product.id);

  const activeCount = product.variants.filter((v) => v.isActive).length;

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
          <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-text-muted">
            <span className="font-mono">{product.sku}</span>
            <span className="rounded-full bg-sand px-2.5 py-0.5 font-bold uppercase tracking-wide text-espresso">
              {isVariable ? `Variable · ${activeCount} active variant${activeCount === 1 ? "" : "s"}` : "Simple"}
            </span>
          </p>
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

      <nav
        aria-label="On this page"
        className="flex flex-wrap gap-2 text-sm font-semibold text-espresso"
      >
        {[
          ["#details", "Details"],
          ...(isVariable ? [["#options", "Options"], ["#variants", "Variants"]] : []),
          ["#photos", isVariable ? "Shared photos" : "Photos"],
          ["#specs", "Specifications"],
        ].map(([href, label]) => (
          <a
            key={href}
            href={href}
            className="rounded-full border border-line bg-white px-3.5 py-1.5 hover:border-espresso"
          >
            {label}
          </a>
        ))}
      </nav>

      {created ? (
        <p
          role="status"
          className="rounded-md border border-oak bg-sand/40 px-4 py-3 text-sm text-espresso"
        >
          {isVariable
            ? "Product created. Define its options below, generate the variants, then price them and add photos."
            : "Product created. Add a photo below, then set the status to Published."}
        </p>
      ) : null}

      <div id="details" className="scroll-mt-24">
        <ProductForm
          type={product.type}
          action={updateProduct.bind(null, product.id)}
          values={values}
          categories={categories}
          currencySymbol={symbol}
          submitLabel="Save changes"
        />
      </div>

      {isVariable ? (
        <>
          <Section
            id="options"
            title="Options"
            note="The ways this product varies. Each combination of values becomes a variant with its own SKU, price, stock, photos and specifications."
          >
            <OptionsEditor
              productId={product.id}
              initial={optionAttributes}
              plan={plan}
            />
          </Section>

          <Section
            id="variants"
            title={`Variants (${product.variants.length})`}
            note="Open a variant to set its SKU, prices, stock, photos and specifications. A variant with order or stock history is deactivated rather than deleted."
          >
            {product.variants.length === 0 ? (
              <p className="rounded-md border border-dashed border-line px-4 py-6 text-center text-sm text-text-muted">
                No variants yet. Save your options above, then generate them.
              </p>
            ) : (
              <div className="space-y-2">
                {product.variants.map((variant) => {
                  const label = variantLabel(
                    [...variant.options]
                      .sort(
                        (a, b) =>
                          (attributeOrder.get(a.attributeId) ?? 0) -
                          (attributeOrder.get(b.attributeId) ?? 0),
                      )
                      .map((o) => ({ name: o.attribute.name, value: o.value.value })),
                  );
                  return (
                    <VariantCard
                      key={variant.id}
                      productId={product.id}
                      currencySymbol={symbol}
                      templates={specTemplates}
                      inherited={productSpecs.map((s) => ({ name: s.name, value: s.value }))}
                      variant={{
                        id: variant.id,
                        sku: variant.sku,
                        label: label || "Variant",
                        price: variant.price.toString(),
                        compareAtPrice: variant.compareAtPrice?.toString() ?? "",
                        stockQuantity: variant.stockQuantity,
                        lowStockThreshold: variant.lowStockThreshold,
                        trackInventory: variant.trackInventory,
                        isActive: variant.isActive,
                        isDefault: variant.isDefault,
                        images: toImages(variant.images),
                        specs: toRows(
                          product.specifications.filter((s) => s.variantId === variant.id),
                        ),
                      }}
                    />
                  );
                })}
              </div>
            )}
          </Section>
        </>
      ) : null}

      <div id="photos" className="scroll-mt-24">
        <ProductImages
          productId={product.id}
          images={toImages(product.images)}
          title={isVariable ? "Shared photos" : "Photos"}
          note={
            isVariable
              ? "Shown on cards, and on any variant that has no photos of its own. The starred image is the first one shown."
              : undefined
          }
        />
      </div>

      <Section
        id="specs"
        title={isVariable ? "Product specifications" : "Specifications"}
        note={
          isVariable
            ? "Apply to every variant. A variant can override any of these, or add its own, from its card above."
            : "Add whatever describes this product. The suggestions come from its category."
        }
      >
        <SpecsEditor
          productId={product.id}
          initial={toRows(productSpecs)}
          templates={specTemplates}
        />
      </Section>

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

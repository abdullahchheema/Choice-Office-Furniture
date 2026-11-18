import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AddToCartPanel } from "@/components/shop/AddToCartPanel";
import { ProductGallery } from "@/components/shop/ProductGallery";
import { ProductGrid } from "@/components/shop/ProductGrid";
import { toProductDTO } from "@/lib/dto";
import { discountPercent, formatMoney } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/queries";
import { resolveImageSrc } from "@/lib/storage/resolve";

/*
 * Rendered per request rather than statically.
 *
 * Price and stock are on this page, and a cached copy showing a chair as
 * available after it sold out is worse than the render cost — this is a shop
 * run by two or three people, not a site under load. `revalidate` would make
 * the staleness bounded but still real.
 */
export const dynamic = "force-dynamic";

const INCLUDE = {
  category: { select: { name: true, slug: true } },
  images: { orderBy: { sortOrder: "asc" } },
} as const;

async function findProduct(slug: string) {
  return prisma.product.findFirst({
    // status in the WHERE, not checked afterwards: a DRAFT or ARCHIVED product
    // must 404, not render with a "not available" notice that search engines
    // then index.
    where: { slug, status: "PUBLISHED" },
    include: INCLUDE,
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await findProduct(slug).catch(() => null);
  if (!product) return { title: "Product not found" };

  const title = product.metaTitle ?? product.name;
  const description =
    product.metaDescription ?? product.shortDescription ?? undefined;
  const image = product.images.find((i) => i.isPrimary) ?? product.images[0];

  return {
    title,
    description,
    alternates: { canonical: `/products/${product.slug}` },
    openGraph: {
      title,
      description,
      type: "website",
      images: image ? [{ url: resolveImageSrc(image.storagePath) }] : undefined,
    },
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [product, settings] = await Promise.all([findProduct(slug), getSettings()]);

  if (!product) notFound();

  const related = await prisma.product.findMany({
    where: {
      status: "PUBLISHED",
      categoryId: product.categoryId,
      id: { not: product.id },
    },
    include: INCLUDE,
    orderBy: [{ isFeatured: "desc" }, { sortOrder: "asc" }],
    take: 4,
  });

  const symbol = settings.currencySymbol;
  const off = discountPercent(product.price, product.compareAtPrice);
  const inStock = !product.trackInventory || product.stockQuantity > 0;
  const isLow =
    product.trackInventory &&
    product.stockQuantity > 0 &&
    product.stockQuantity <= product.lowStockThreshold;

  const specs: [string, string][] = [
    ["SKU", product.sku],
    ...(product.material ? ([["Material", product.material]] as [string, string][]) : []),
    ...(product.dimensions
      ? ([["Dimensions", product.dimensions]] as [string, string][])
      : []),
    ...(product.weightKg
      ? ([["Weight", `${product.weightKg.toString()} kg`]] as [string, string][])
      : []),
    ...(product.warrantyMonths
      ? ([
          [
            "Warranty",
            product.warrantyMonths % 12 === 0
              ? `${product.warrantyMonths / 12} year${product.warrantyMonths === 12 ? "" : "s"}`
              : `${product.warrantyMonths} months`,
          ],
        ] as [string, string][])
      : []),
    ["Assembly", product.assemblyRequired ? "Required — we assemble on delivery" : "Pre-assembled"],
  ];

  /*
   * Product structured data. Worth the markup: it is what produces the price
   * and availability chips in Google results, and the values come from the
   * same row the page renders, so they cannot disagree with it.
   */
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    sku: product.sku,
    description: product.shortDescription ?? product.description ?? undefined,
    category: product.category.name,
    image: product.images.map((image) => resolveImageSrc(image.storagePath)),
    offers: {
      "@type": "Offer",
      price: product.price.toString(),
      priceCurrency: product.currency,
      availability: inStock
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        // Values come from our own database, and JSON.stringify escapes the
        // quotes; the only remaining hazard in a JSON-LD block is a literal
        // "</script>" inside a string, which this neutralises.
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />

      <section className="section section--flush">
        <div className="shell">
          <nav className="crumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link>
            <span aria-hidden="true">/</span>
            <Link href="/shop">Shop</Link>
            <span aria-hidden="true">/</span>
            <Link href={`/shop?category=${product.category.slug}`}>
              {product.category.name}
            </Link>
          </nav>

          <div className="pdp">
            <ProductGallery
              images={product.images.map((image) => ({
                src: resolveImageSrc(image.storagePath),
                alt: image.altText,
                width: image.width,
                height: image.height,
                objectPosition:
                  image.objectPosition ?? product.imageObjectPosition ?? null,
              }))}
              toneHex={product.toneHex}
              lift={product.imageLift}
            />

            <div className="pdp-info">
              <p className="eyebrow">{product.category.name}</p>
              <h1>{product.name}</h1>

              <div className="pdp-price">
                <span className="now">{formatMoney(product.price, symbol)}</span>
                {product.compareAtPrice ? (
                  <span className="was">
                    {formatMoney(product.compareAtPrice, symbol)}
                  </span>
                ) : null}
                {off ? <span className="off">{off}% off</span> : null}
              </div>

              <p
                className={`stock-line${isLow ? " is-low" : ""}${
                  inStock ? "" : " is-out"
                }`}
              >
                <span className="dot" aria-hidden="true" />
                {!inStock
                  ? "Out of stock — message us for lead times"
                  : isLow
                    ? `Only ${product.stockQuantity} left in stock`
                    : "In stock, ready to deliver"}
              </p>

              {product.shortDescription ? (
                <p className="pdp-desc" style={{ marginTop: 18 }}>
                  {product.shortDescription}
                </p>
              ) : null}

              <AddToCartPanel
                productId={product.id}
                productName={product.name}
                productSlug={product.sku}
                inStock={inStock}
                maxQty={product.trackInventory ? product.stockQuantity : 99}
              />

              <dl className="spec-list" style={{ marginTop: 26 }}>
                {specs.map(([key, value]) => (
                  <div key={key}>
                    <dt>{key}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>

          {product.description ? (
            <div className="panel" style={{ marginTop: "clamp(40px, 6vw, 72px)" }}>
              <h2>About this piece</h2>
              <div
                className="pdp-desc"
                style={{ marginTop: 12, whiteSpace: "pre-line" }}
              >
                {product.description}
              </div>
            </div>
          ) : null}
        </div>
      </section>

      {related.length > 0 ? (
        <section className="section section--tint">
          <div className="shell">
            <header className="section-head" data-reveal>
              <p className="eyebrow">More from {product.category.name}</p>
              <h2>You might also like</h2>
            </header>
            <ProductGrid
              products={related.map((item) => toProductDTO(item, symbol))}
            />
          </div>
        </section>
      ) : null}
    </>
  );
}

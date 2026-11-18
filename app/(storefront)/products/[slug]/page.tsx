import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ProductDetail } from "@/components/shop/ProductDetail";
import { ProductGrid } from "@/components/shop/ProductGrid";
import { CARD_INCLUDE, toProductDTO } from "@/lib/dto";
import { prisma } from "@/lib/prisma";
import { getProductDetail, getSettings } from "@/lib/queries";

/*
 * Rendered per request rather than statically.
 *
 * Price and stock are on this page, per variant, and a cached copy showing a
 * variant as available after it sold out is worse than the render cost — this
 * is a shop run by two or three people, not a site under load.
 */
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductDetail(slug).catch(() => null);
  if (!product) return { title: "Product not found" };

  const description = product.shortDescription ?? undefined;
  const image = product.image?.src;

  return {
    title: product.name,
    description,
    alternates: { canonical: `/products/${product.slug}` },
    openGraph: {
      title: product.name,
      description,
      type: "website",
      images: image ? [{ url: image }] : undefined,
    },
  };
}

export default async function ProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ variant?: string }>;
}) {
  const [{ slug }, { variant: variantParam }] = await Promise.all([params, searchParams]);
  const [product, settings] = await Promise.all([getProductDetail(slug), getSettings()]);

  if (!product) notFound();

  // ?variant= carries a SKU (readable, shareable); an id works too.
  const initial = product.variants.find(
    (v) => v.sku === variantParam || v.id === variantParam,
  );

  const category = await prisma.category.findUnique({
    where: { slug: product.categorySlug },
    select: { id: true },
  });
  const related = category
    ? await prisma.product.findMany({
        where: {
          status: "PUBLISHED",
          categoryId: category.id,
          id: { not: product.id },
          variants: { some: { isActive: true } },
        },
        include: CARD_INCLUDE,
        orderBy: [{ isFeatured: "desc" }, { sortOrder: "asc" }],
        take: 4,
      })
    : [];

  /*
   * Product structured data, one Offer per variant. Worth the markup: it is
   * what produces the price and availability chips in search results, and every
   * value comes from the same rows the page renders, so it cannot disagree
   * with what the customer sees.
   */
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    sku: product.sku,
    description: product.shortDescription ?? product.description ?? undefined,
    category: product.categoryName,
    image: [...product.images, ...product.variants.flatMap((v) => v.images)].map((i) => i.src),
    offers: product.variants.map((variant) => ({
      "@type": "Offer",
      sku: variant.sku,
      name: variant.label || product.name,
      price: variant.priceValue,
      priceCurrency: "PKR",
      availability: variant.inStock
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
    })),
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
            <Link href={`/shop?category=${product.categorySlug}`}>{product.categoryName}</Link>
          </nav>

          <ProductDetail product={product} initialVariantId={initial?.id} />

          {product.description ? (
            <div className="panel" style={{ marginTop: 24 }}>
              <h2>About this piece</h2>
              <div className="pdp-desc" style={{ marginTop: 12, whiteSpace: "pre-line" }}>
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
              <p className="eyebrow">More from {product.categoryName}</p>
              <h2>You might also like</h2>
            </header>
            <ProductGrid
              products={related.map((item) => toProductDTO(item, settings.currencySymbol))}
            />
          </div>
        </section>
      ) : null}
    </>
  );
}

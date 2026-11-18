import type { MetadataRoute } from "next";

import { prisma } from "@/lib/prisma";
import { siteUrl } from "@/lib/site-url";

/*
 * Built from the database on request, so a published product appears here
 * without a deploy and an archived one drops out. Only things a search engine
 * should index: never the cart, checkout, order pages or admin.
 */
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/shop`, changeFrequency: "daily", priority: 0.9 },
    ...["contact", "delivery", "returns", "privacy", "terms"].map((slug) => ({
      url: `${base}/${slug}`,
      changeFrequency: "yearly" as const,
      priority: 0.3,
    })),
  ];

  try {
    const [products, categories] = await Promise.all([
      prisma.product.findMany({
        // Same rule as the storefront: published AND something to sell.
        where: { status: "PUBLISHED", variants: { some: { isActive: true } } },
        select: { slug: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.category.findMany({
        where: { isActive: true, products: { some: { status: "PUBLISHED" } } },
        select: { slug: true, updatedAt: true },
      }),
    ]);

    return [
      ...staticPages,
      ...categories.map((c) => ({
        url: `${base}/shop?category=${c.slug}`,
        lastModified: c.updatedAt,
        changeFrequency: "weekly" as const,
        priority: 0.7,
      })),
      ...products.map((p) => ({
        url: `${base}/products/${p.slug}`,
        lastModified: p.updatedAt,
        changeFrequency: "weekly" as const,
        priority: 0.8,
      })),
    ];
  } catch (error) {
    // A sitemap that errors is worse than a short one: crawlers back off.
    console.error("[sitemap] database unavailable, serving static pages only", error);
    return staticPages;
  }
}

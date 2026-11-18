import Link from "next/link";

import { prisma } from "@/lib/prisma";

export const metadata = { title: "Homepage" };

const DESCRIPTIONS: Record<string, string> = {
  hero: "The full-width banner and its headline.",
  trust: "The four promises below the hero.",
  collections: "The category grid heading.",
  featured: "The product strip heading.",
  craft: "The craftsmanship story.",
  finishes: "The wood finish picker.",
  testimonials: "Customer quotes.",
  visit: "Showroom details and the newsletter.",
};

export default async function AdminHomepagePage() {
  const [sections, featured, bestsellers, homepageCategories] = await Promise.all([
    prisma.homepageSection.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.product.findMany({
      where: { isFeatured: true, status: "PUBLISHED" },
      select: { id: true, name: true },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.product.findMany({
      where: { isBestseller: true, status: "PUBLISHED" },
      select: { id: true, name: true },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.category.findMany({
      where: { showOnHomepage: true, isActive: true },
      select: { id: true, name: true },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink">
          Homepage
        </h1>
        <p className="mt-1 max-w-prose text-sm text-text-muted">
          What currently fills each section. Products are chosen with the
          Featured and Bestseller toggles on each product; the collection grid
          follows the “Show on homepage” flag on categories.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <Picks
          title="Featured products"
          items={featured}
          empty="No products are flagged as featured."
          hint="Toggle “Featured on the homepage” when editing a product."
        />
        <Picks
          title="Bestsellers"
          items={bestsellers}
          empty="No products are flagged as bestsellers."
          hint="Toggle “Mark as bestseller” when editing a product."
        />
        <Picks
          title="Collection grid"
          items={homepageCategories}
          empty="No categories are shown on the homepage."
          hint="Toggle “Show on homepage” when editing a category."
          href="/admin/categories"
        />
      </div>

      <section className="overflow-hidden rounded-card border border-line bg-white">
        <h2 className="border-b border-line px-6 py-4 font-display text-lg font-extrabold text-ink">
          Sections
        </h2>
        <ul className="divide-y divide-line">
          {sections.map((section) => (
            <li key={section.id} className="px-6 py-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-semibold capitalize text-espresso">
                  {section.key}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[0.68rem] font-bold ${
                    section.isVisible
                      ? "bg-espresso text-cream"
                      : "border border-line text-text-muted"
                  }`}
                >
                  {section.isVisible ? "Visible" : "Hidden"}
                </span>
              </div>
              <p className="mt-1 text-xs text-text-muted">
                {DESCRIPTIONS[section.key] ?? "Homepage section."}
              </p>
              {section.heading ? (
                <p className="mt-2 text-sm text-espresso">
                  <span className="text-text-muted">Heading: </span>
                  {section.heading}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Picks({
  title,
  items,
  empty,
  hint,
  href,
}: {
  title: string;
  items: { id: string; name: string }[];
  empty: string;
  hint: string;
  href?: string;
}) {
  return (
    <section className="rounded-card border border-line bg-white p-6">
      <h2 className="font-display text-lg font-extrabold text-ink">{title}</h2>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-text-muted">{empty}</p>
      ) : (
        <ul className="mt-3 space-y-1.5 text-sm">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={href ?? `/admin/products/${item.id}`}
                className="font-semibold text-espresso hover:text-clay"
              >
                {item.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs text-text-muted">{hint}</p>
    </section>
  );
}

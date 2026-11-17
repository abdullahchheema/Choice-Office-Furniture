import { CollectionsGrid } from "@/components/home/CollectionsGrid";
import { CraftSection } from "@/components/home/CraftSection";
import { FinishPicker } from "@/components/home/FinishPicker";
import { Hero } from "@/components/home/Hero";
import { ShopSection, type ShopFilter } from "@/components/home/ShopSection";
import { Testimonials } from "@/components/home/Testimonials";
import { TrustStrip } from "@/components/home/TrustStrip";
import { VisitSection } from "@/components/home/VisitSection";
import { getHomepageCategories, getShopProducts } from "@/lib/queries";
import { safeQuery } from "@/lib/safe";

/*
 * Revalidate daily rather than rendering per request. Product data changes
 * when an admin edits it, and Phase 4 calls revalidateTag on those writes, so
 * this is only a backstop.
 */
export const revalidate = 86400;

export default async function HomePage() {
  const [products, categories] = await Promise.all([
    safeQuery("homepage products", () => getShopProducts(12), []),
    safeQuery("homepage categories", getHomepageCategories, []),
  ]);

  /*
   * Filter chips are built from the categories actually present in the
   * returned products, so a chip can never select an empty grid.
   */
  const seen = new Map<string, string>();
  for (const product of products) {
    if (!seen.has(product.categorySlug)) {
      seen.set(product.categorySlug, product.categoryName);
    }
  }
  const filters: ShopFilter[] = [
    { value: "all", label: "All" },
    ...Array.from(seen, ([value, label]) => ({ value, label })),
  ];

  return (
    <>
      <Hero />
      <TrustStrip />
      <CollectionsGrid categories={categories} />
      {products.length > 0 ? (
        <ShopSection products={products} filters={filters} />
      ) : (
        <EmptyCatalogNotice />
      )}
      <CraftSection />
      <FinishPicker />
      <Testimonials />
      <VisitSection />
    </>
  );
}

/** Shown when the database has no published products — usually because the
 *  connection string is not configured or the seed has not run. */
function EmptyCatalogNotice() {
  return (
    <section className="section section--tint" id="shop">
      <div className="shell">
        <header className="section-head">
          <p className="eyebrow">Featured</p>
          <h2>
            The catalog is <em>on its way</em>
          </h2>
          <p className="section-sub">
            No published products yet. Add the database connection strings to{" "}
            <code>.env.local</code>, then run <code>npm run db:migrate</code> and{" "}
            <code>npm run db:seed</code>.
          </p>
        </header>
      </div>
    </section>
  );
}

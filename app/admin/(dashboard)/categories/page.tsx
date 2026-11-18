import { CategoryEditor } from "@/components/admin/CategoryEditor";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Categories" };

export default async function AdminCategoriesPage() {
  const categories = await prisma.category.findMany({
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { products: true } } },
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink">
          Categories
        </h1>
        <p className="mt-1 max-w-prose text-sm text-text-muted">
          Order controls where they appear. The four marked “On homepage” fill
          the collection grid. A category holding products is deactivated
          rather than deleted, so nothing is orphaned.
        </p>
      </header>

      <CategoryEditor
        categories={categories.map((category) => ({
          id: category.id,
          name: category.name,
          slug: category.slug,
          description: category.description ?? "",
          toneHex: category.toneHex ?? "",
          imagePath: category.imagePath ?? "",
          sortOrder: category.sortOrder,
          isActive: category.isActive,
          showOnHomepage: category.showOnHomepage,
          productCount: category._count.products,
        }))}
      />
    </div>
  );
}

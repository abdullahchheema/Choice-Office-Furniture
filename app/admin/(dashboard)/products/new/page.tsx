import Link from "next/link";

import { ProductForm, type ProductFormValues } from "@/components/admin/ProductForm";
import { createProduct } from "@/lib/actions/products";
import { prisma } from "@/lib/prisma";
import { getSettingsOrNull } from "@/lib/queries";

export const metadata = { title: "New product" };

const BLANK: ProductFormValues = {
  name: "",
  slug: "",
  sku: "",
  categoryId: "",
  shortDescription: "",
  description: "",
  price: "",
  compareAtPrice: "",
  stockQuantity: 0,
  lowStockThreshold: 3,
  trackInventory: true,
  status: "DRAFT",
  isFeatured: false,
  isBestseller: false,
  badge: "",
  toneHex: "#E8D9C3",
  imageObjectPosition: "50% 50%",
  imageLift: false,
  metaTitle: "",
  metaDescription: "",
};

export default async function NewProductPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { type: typeParam } = await searchParams;
  const type = typeParam === "variable" ? "VARIABLE" : "SIMPLE";

  const [categories, settings] = await Promise.all([
    prisma.category.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true },
    }),
    getSettingsOrNull(),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <Link
          href="/admin/products"
          className="text-sm font-semibold text-text-muted hover:text-clay"
        >
          ← Products
        </Link>
        <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-ink">
          New product
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          Save it as a draft first — photos, options and specifications are added on the
          next screen.
        </p>
      </header>

      {/* The type is fixed once the product exists, so it is chosen here. */}
      <fieldset className="grid gap-3 sm:grid-cols-2" aria-label="Product type">
        {(
          [
            {
              key: "SIMPLE",
              href: "/admin/products/new",
              title: "Simple product",
              body: "One price, one SKU, one stock count. A filing cabinet, a monitor arm.",
            },
            {
              key: "VARIABLE",
              href: "/admin/products/new?type=variable",
              title: "Variable product",
              body: "Options like colour, material or size — each combination gets its own SKU, price, stock and photos.",
            },
          ] as const
        ).map((option) => (
          <Link
            key={option.key}
            href={option.href}
            aria-current={type === option.key}
            className={`rounded-card border p-5 transition-colors ${
              type === option.key
                ? "border-espresso bg-espresso text-cream"
                : "border-line bg-white hover:border-espresso"
            }`}
          >
            <span className="block font-display text-lg font-extrabold">{option.title}</span>
            <span
              className={`mt-1 block text-sm ${type === option.key ? "text-cream/80" : "text-text-muted"}`}
            >
              {option.body}
            </span>
          </Link>
        ))}
      </fieldset>

      {/* Keyed by type so switching starts a clean form for the other shape. */}
      <ProductForm
        key={type}
        type={type}
        isNew
        action={createProduct}
        values={BLANK}
        categories={categories}
        currencySymbol={settings?.currencySymbol ?? "Rs."}
        submitLabel={type === "VARIABLE" ? "Create and add options" : "Create product"}
      />
    </div>
  );
}

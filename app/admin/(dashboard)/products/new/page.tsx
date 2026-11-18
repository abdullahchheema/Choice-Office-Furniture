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
  material: "",
  dimensions: "",
  warrantyMonths: "",
  metaTitle: "",
  metaDescription: "",
};

export default async function NewProductPage() {
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
          Save it as a draft first — photos are added on the next screen.
        </p>
      </header>

      <ProductForm
        action={createProduct}
        values={BLANK}
        categories={categories}
        currencySymbol={settings?.currencySymbol ?? "Rs."}
        submitLabel="Create product"
      />
    </div>
  );
}

"use client";

import { ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useState, useTransition } from "react";

import { FIELD, LABEL, Notice, SubmitButton } from "@/components/admin/form-bits";
import { ProductImages } from "@/components/admin/ProductImages";
import { SpecsEditor, type SpecRowInput, type SpecTemplateRow } from "@/components/admin/SpecsEditor";
import { deleteVariant, updateVariant, type VariantActionState } from "@/lib/actions/variants";

export type VariantCardData = {
  id: string;
  sku: string;
  label: string;
  price: string;
  compareAtPrice: string;
  stockQuantity: number;
  lowStockThreshold: number;
  trackInventory: boolean;
  isActive: boolean;
  isDefault: boolean;
  images: { id: string; src: string; alt: string; isPrimary: boolean }[];
  specs: SpecRowInput[];
};

/** The same arithmetic the storefront uses, previewed live while typing. */
function previewDiscount(price: string, compare: string): number | null {
  const p = Number(price);
  const c = Number(compare);
  if (!(p > 0) || !(c > p)) return null;
  return Math.round(((c - p) / c) * 100);
}

/**
 * One variant, editable in place: commercial fields, its own photos, and its
 * own specifications. Collapsed it is a one-line summary, so a product with
 * thirty variants stays scannable.
 */
export function VariantCard({
  productId,
  variant,
  currencySymbol,
  templates,
  inherited,
  defaultOpen = false,
}: {
  productId: string;
  variant: VariantCardData;
  currencySymbol: string;
  templates: SpecTemplateRow[];
  inherited: { name: string; value: string }[];
  defaultOpen?: boolean;
}) {
  const router = useRouter();
  const [state, action] = useActionState<VariantActionState, FormData>(
    updateVariant.bind(null, variant.id),
    {},
  );
  const [pending, startTransition] = useTransition();
  const [removeMessage, setRemoveMessage] = useState<VariantActionState>({});
  const [price, setPrice] = useState(variant.price);
  const [compare, setCompare] = useState(variant.compareAtPrice);
  const discount = previewDiscount(price, compare);

  const out = variant.trackInventory && variant.stockQuantity <= 0;
  const low =
    variant.trackInventory && !out && variant.stockQuantity <= variant.lowStockThreshold;

  return (
    <details
      className="group rounded-md border border-line bg-white open:shadow-[0_18px_40px_-30px_rgba(59,42,30,0.5)]"
      open={defaultOpen || undefined}
    >
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 [&::-webkit-details-marker]:hidden">
        <ChevronDown
          size={16}
          aria-hidden="true"
          className="shrink-0 text-text-muted transition-transform group-open:rotate-180"
        />
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-espresso">{variant.label}</span>
          <span className="font-mono text-xs text-text-muted">{variant.sku}</span>
        </span>
        <span className="text-sm font-bold text-espresso">
          {currencySymbol} {Number(variant.price).toLocaleString("en-US")}
        </span>
        <span
          className={`text-sm font-semibold ${out ? "text-destructive" : low ? "text-clay" : "text-espresso"}`}
        >
          {variant.trackInventory ? `${variant.stockQuantity} in stock` : "Untracked"}
        </span>
        {variant.isDefault ? (
          <span className="rounded-full bg-espresso px-2.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-cream">
            Default
          </span>
        ) : null}
        {!variant.isActive ? (
          <span className="rounded-full border border-line px-2.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-text-muted">
            Inactive
          </span>
        ) : null}
      </summary>

      <div className="space-y-6 border-t border-line p-4">
        <form action={action} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className={LABEL} htmlFor={`sku-${variant.id}`}>
                SKU
              </label>
              <input
                id={`sku-${variant.id}`}
                name="sku"
                defaultValue={variant.sku}
                required
                className={`${FIELD} font-mono`}
              />
            </div>
            <div>
              <label className={LABEL} htmlFor={`price-${variant.id}`}>
                Regular price ({currencySymbol})
              </label>
              <input
                id={`price-${variant.id}`}
                name="price"
                value={price}
                onChange={(event) => setPrice(event.target.value)}
                inputMode="decimal"
                required
                className={FIELD}
              />
            </div>
            <div>
              <label className={LABEL} htmlFor={`compare-${variant.id}`}>
                Compare-at ({currencySymbol})
              </label>
              <input
                id={`compare-${variant.id}`}
                name="compareAtPrice"
                value={compare}
                onChange={(event) => setCompare(event.target.value)}
                inputMode="decimal"
                placeholder="Optional"
                className={FIELD}
              />
            </div>
            <div>
              <p className={LABEL}>Sale badge</p>
              <p
                className={`rounded-md border px-3 py-2 text-sm font-bold ${
                  discount
                    ? "border-clay bg-clay/10 text-clay"
                    : "border-dashed border-line text-text-muted"
                }`}
                aria-live="polite"
              >
                {discount ? `-${discount}% shown automatically` : "None — no compare-at price"}
              </p>
            </div>

            <div>
              <label className={LABEL} htmlFor={`stock-${variant.id}`}>
                Stock on hand
              </label>
              <input
                id={`stock-${variant.id}`}
                name="stockQuantity"
                type="number"
                min={0}
                defaultValue={variant.stockQuantity}
                className={FIELD}
              />
            </div>
            <div>
              <label className={LABEL} htmlFor={`low-${variant.id}`}>
                Low-stock alert at
              </label>
              <input
                id={`low-${variant.id}`}
                name="lowStockThreshold"
                type="number"
                min={0}
                defaultValue={variant.lowStockThreshold}
                className={FIELD}
              />
            </div>
            <div className="flex flex-col justify-end gap-1 sm:col-span-2">
              <label className="flex items-center gap-2.5 py-1 text-sm font-semibold text-espresso">
                <input
                  type="checkbox"
                  name="trackInventory"
                  defaultChecked={variant.trackInventory}
                  className="h-4 w-4 accent-[var(--color-espresso)]"
                />
                Track inventory for this variant
              </label>
              <div className="flex flex-wrap gap-x-6">
                <label className="flex items-center gap-2.5 py-1 text-sm font-semibold text-espresso">
                  <input
                    type="checkbox"
                    name="isActive"
                    defaultChecked={variant.isActive}
                    className="h-4 w-4 accent-[var(--color-espresso)]"
                  />
                  Active (visible in the shop)
                </label>
                <label className="flex items-center gap-2.5 py-1 text-sm font-semibold text-espresso">
                  <input
                    type="checkbox"
                    name="isDefault"
                    defaultChecked={variant.isDefault}
                    className="h-4 w-4 accent-[var(--color-espresso)]"
                  />
                  Preselected on the product page
                </label>
              </div>
            </div>
          </div>

          <p className="text-xs text-text-muted">
            Stock changes are written to the inventory ledger with your name. Customers
            see the availability of this variant only — other variants sell independently.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <SubmitButton>Save variant</SubmitButton>
            <button
              type="button"
              disabled={pending}
              className="rounded-full border border-destructive px-4 py-2 text-sm font-bold text-destructive transition-colors hover:bg-destructive hover:text-cream disabled:opacity-50"
              onClick={() => {
                if (!window.confirm(`Remove “${variant.label}” (${variant.sku})?`)) return;
                startTransition(async () => {
                  const result = await deleteVariant(variant.id);
                  setRemoveMessage(result);
                  router.refresh();
                });
              }}
            >
              Remove variant
            </button>
            <Notice
              error={state.error ?? removeMessage.error}
              message={state.message ?? removeMessage.message}
            />
          </div>
        </form>

        <ProductImages
          compact
          productId={productId}
          variantId={variant.id}
          images={variant.images}
          title="This variant’s photos"
          note="Shown instead of the shared gallery whenever this variant is selected."
        />

        <div>
          <h4 className="text-xs font-bold uppercase tracking-[0.12em] text-text-muted">
            This variant’s specifications
          </h4>
          <div className="mt-2">
            <SpecsEditor
              productId={productId}
              variantId={variant.id}
              initial={variant.specs}
              templates={templates}
              inherited={inherited}
            />
          </div>
        </div>
      </div>
    </details>
  );
}

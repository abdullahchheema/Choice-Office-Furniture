"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import type { FormState } from "@/lib/actions/products";

const FIELD =
  "w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-espresso outline-none placeholder:text-text-muted/60 focus-visible:border-clay focus-visible:ring-2 focus-visible:ring-clay/25";
const LABEL =
  "mb-1.5 block text-xs font-bold uppercase tracking-[0.12em] text-text-muted";

export type ProductFormValues = {
  name: string;
  slug: string;
  sku: string;
  categoryId: string;
  shortDescription: string;
  description: string;
  price: string;
  compareAtPrice: string;
  stockQuantity: number;
  lowStockThreshold: number;
  trackInventory: boolean;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  isFeatured: boolean;
  isBestseller: boolean;
  badge: string;
  toneHex: string;
  imageObjectPosition: string;
  imageLift: boolean;
  metaTitle: string;
  metaDescription: string;
};

export function ProductForm({
  action,
  values,
  categories,
  currencySymbol,
  submitLabel,
  type,
  isNew = false,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  values: ProductFormValues;
  categories: { id: string; name: string }[];
  currencySymbol: string;
  submitLabel: string;
  /** Fixed at creation. Variable products price and stock per variant. */
  type: "SIMPLE" | "VARIABLE";
  isNew?: boolean;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(action, {});
  const err = (field: string) => state.fieldErrors?.[field];

  return (
    <form action={formAction} className="space-y-8">
      <input type="hidden" name="type" value={type} />

      {state.saved ? (
        <p
          role="status"
          className="rounded-md border border-oak bg-sand/40 px-4 py-3 text-sm font-semibold text-espresso"
        >
          Saved.
        </p>
      ) : null}
      {state.error ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          {state.error}
        </p>
      ) : null}

      <Section title="Details">
        <Field label="Name" error={err("name")} className="sm:col-span-2">
          <input name="name" defaultValue={values.name} required className={FIELD} />
        </Field>

        <Field
          label="URL slug"
          hint="Leave blank to build it from the name"
          error={err("slug")}
        >
          <input name="slug" defaultValue={values.slug} className={FIELD} />
        </Field>

        <Field
          label={type === "VARIABLE" ? "Base SKU" : "SKU"}
          hint={
            type === "VARIABLE"
              ? "Variant SKUs are built from this, e.g. CH-EXE-001-BLK-LEA"
              : undefined
          }
          error={err("sku")}
        >
          <input name="sku" defaultValue={values.sku} required className={FIELD} />
        </Field>

        <Field label="Category" error={err("categoryId")}>
          <select
            name="categoryId"
            defaultValue={values.categoryId}
            required
            className={FIELD}
          >
            <option value="">Choose…</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Status" error={err("status")}>
          <select name="status" defaultValue={values.status} className={FIELD}>
            <option value="DRAFT">Draft — hidden from the shop</option>
            {/* A new variable product has no variants to sell yet. */}
            {isNew && type === "VARIABLE" ? null : (
              <option value="PUBLISHED">Published — live</option>
            )}
            <option value="ARCHIVED">Archived — retired</option>
          </select>
        </Field>

        <Field
          label="Short description"
          hint="One line, shown on cards"
          error={err("shortDescription")}
          className="sm:col-span-2"
        >
          <input
            name="shortDescription"
            defaultValue={values.shortDescription}
            className={FIELD}
          />
        </Field>

        <Field label="Full description" className="sm:col-span-2">
          <textarea
            name="description"
            defaultValue={values.description}
            rows={5}
            className={FIELD}
          />
        </Field>
      </Section>

      {type === "SIMPLE" ? (
        <Section title="Pricing and stock">
          <Field label={`Price (${currencySymbol})`} error={err("price")}>
            <input
              name="price"
              defaultValue={values.price}
              inputMode="decimal"
              required
              className={FIELD}
            />
          </Field>

          <Field
            label={`Compare-at (${currencySymbol})`}
            hint="Optional — shown struck through, and the discount badge is worked out from it"
            error={err("compareAtPrice")}
          >
            <input
              name="compareAtPrice"
              defaultValue={values.compareAtPrice}
              inputMode="decimal"
              className={FIELD}
            />
          </Field>

          <Field
            label="Stock quantity"
            hint="A change here is recorded as a ledger adjustment"
            error={err("stockQuantity")}
          >
            <input
              name="stockQuantity"
              type="number"
              min={0}
              defaultValue={values.stockQuantity}
              className={FIELD}
            />
          </Field>

          <Field label="Low-stock threshold" error={err("lowStockThreshold")}>
            <input
              name="lowStockThreshold"
              type="number"
              min={0}
              defaultValue={values.lowStockThreshold}
              className={FIELD}
            />
          </Field>

          <Toggle name="trackInventory" label="Track inventory" defaultChecked={values.trackInventory} />
        </Section>
      ) : (
        <Section title="Pricing and stock">
          <p className="text-sm text-text-muted sm:col-span-2">
            This is a variable product: price, compare-at price, SKU and stock are set
            on each variant, so a black chair and a grey chair can differ in all four.
            {isNew ? " Add the options and generate variants on the next screen." : ""}
          </p>
        </Section>
      )}

      <Section title="Merchandising">
        <Toggle name="isFeatured" label="Featured on the homepage" defaultChecked={values.isFeatured} />
        <Toggle name="isBestseller" label="Mark as bestseller" defaultChecked={values.isBestseller} />
        <Field
          label="Badge"
          hint='Optional manual badge, e.g. "New". The sale % and "Low stock" appear automatically.'
          error={err("badge")}
        >
          <input name="badge" defaultValue={values.badge} className={FIELD} />
        </Field>
      </Section>

      <Section
        title="Presentation"
        note="These carry over the per-photo tuning from the original design, so each card keeps its own crop and backdrop."
      >
        <Field
          label="Backdrop colour"
          hint="Hex, shown behind the photo"
          error={err("toneHex")}
        >
          <input
            name="toneHex"
            defaultValue={values.toneHex}
            placeholder="#E8D9C3"
            className={FIELD}
          />
        </Field>

        <Field
          label="Image focus"
          hint='CSS object-position, e.g. "38% 50%"'
          error={err("imageObjectPosition")}
        >
          <input
            name="imageObjectPosition"
            defaultValue={values.imageObjectPosition}
            placeholder="50% 50%"
            className={FIELD}
          />
        </Field>

        <Toggle
          name="imageLift"
          label="Brighten and zoom (for dark photos)"
          defaultChecked={values.imageLift}
        />
      </Section>

      <Section title="Search listing">
        <Field label="SEO title" error={err("metaTitle")} className="sm:col-span-2">
          <input name="metaTitle" defaultValue={values.metaTitle} className={FIELD} />
        </Field>
        <Field
          label="SEO description"
          error={err("metaDescription")}
          className="sm:col-span-2"
        >
          <textarea
            name="metaDescription"
            defaultValue={values.metaDescription}
            rows={2}
            className={FIELD}
          />
        </Field>
      </Section>

      <Submit label={submitLabel} />
    </form>
  );
}

function Section({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-card border border-line bg-white p-6">
      <h2 className="font-display text-lg font-extrabold text-ink">{title}</h2>
      {note ? <p className="mt-1 text-xs text-text-muted">{note}</p> : null}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function Field({
  label,
  hint,
  error,
  className = "",
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label className={LABEL}>{label}</label>
      {children}
      {/* Errors sit next to their field, not collected at the top of the form. */}
      {error ? (
        <p className="mt-1 text-xs font-semibold text-destructive">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

function Toggle({
  name,
  label,
  defaultChecked,
}: {
  name: string;
  label: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="flex items-center gap-2.5 self-end py-2 text-sm font-semibold text-espresso">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="h-4 w-4 accent-[var(--color-espresso)]"
      />
      {label}
    </label>
  );
}

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <div className="sticky bottom-4 flex justify-end">
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-espresso px-7 py-3 text-sm font-bold text-cream shadow-[0_14px_30px_-14px_rgba(59,42,30,0.55)] transition-colors hover:bg-walnut disabled:opacity-60"
      >
        {pending ? "Saving…" : label}
      </button>
    </div>
  );
}

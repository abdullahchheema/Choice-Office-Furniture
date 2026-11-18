"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState, useTransition } from "react";

import {
  deleteCategory,
  saveCategory,
  type CategoryState,
} from "@/lib/actions/categories";

const FIELD =
  "w-full rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus-visible:border-clay";

export type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  description: string;
  toneHex: string;
  imagePath: string;
  sortOrder: number;
  isActive: boolean;
  showOnHomepage: boolean;
  productCount: number;
};

export function CategoryEditor({ categories }: { categories: CategoryRow[] }) {
  const [editing, setEditing] = useState<CategoryRow | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <>
      <div className="overflow-hidden rounded-card border border-line bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line bg-cream text-xs uppercase tracking-[0.1em] text-text-muted">
              <tr>
                <th scope="col" className="px-4 py-3 font-bold">Order</th>
                <th scope="col" className="px-4 py-3 font-bold">Name</th>
                <th scope="col" className="px-4 py-3 font-bold">Slug</th>
                <th scope="col" className="px-4 py-3 text-right font-bold">Products</th>
                <th scope="col" className="px-4 py-3 font-bold">Visibility</th>
                <th scope="col" className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {categories.map((category) => (
                <tr key={category.id} className="hover:bg-cream/60">
                  <td className="px-4 py-3 text-text-muted">{category.sortOrder}</td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-2 font-semibold text-espresso">
                      <span
                        className="h-4 w-4 shrink-0 rounded border border-line"
                        style={{ background: category.toneHex || "#EFE6D8" }}
                        aria-hidden="true"
                      />
                      {category.name}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-text-muted">
                    {category.slug}
                  </td>
                  <td className="px-4 py-3 text-right">{category.productCount}</td>
                  <td className="px-4 py-3">
                    <span className="flex flex-wrap gap-1.5">
                      <Tag on={category.isActive} onLabel="Active" offLabel="Hidden" />
                      {category.showOnHomepage ? (
                        <span className="rounded-full bg-oak/30 px-2 py-0.5 text-[0.68rem] font-bold text-espresso">
                          On homepage
                        </span>
                      ) : null}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => {
                        setCreating(false);
                        setEditing(category);
                      }}
                      className="text-sm font-semibold text-clay hover:underline"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <button
        type="button"
        onClick={() => {
          setEditing(null);
          setCreating(true);
        }}
        className="inline-flex items-center gap-2 rounded-full bg-espresso px-5 py-2.5 text-sm font-bold text-cream transition-colors hover:bg-walnut"
      >
        <Plus size={16} aria-hidden="true" />
        New category
      </button>

      {(editing || creating) && (
        <CategoryForm
          category={editing}
          onDone={() => {
            setEditing(null);
            setCreating(false);
          }}
        />
      )}
    </>
  );
}

function Tag({
  on,
  onLabel,
  offLabel,
}: {
  on: boolean;
  onLabel: string;
  offLabel: string;
}) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[0.68rem] font-bold ${
        on ? "bg-espresso text-cream" : "border border-line text-text-muted"
      }`}
    >
      {on ? onLabel : offLabel}
    </span>
  );
}

function CategoryForm({
  category,
  onDone,
}: {
  category: CategoryRow | null;
  onDone: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [state, formAction] = useActionState<CategoryState, FormData>(
    saveCategory,
    {},
  );

  // Close and refresh once the server confirms the write.
  useEffect(() => {
    if (state.saved) {
      router.refresh();
      onDone();
    }
  }, [state.saved, router, onDone]);

  return (
    <section className="rounded-card border border-line bg-white p-6">
      <h2 className="font-display text-lg font-extrabold text-ink">
        {category ? `Edit ${category.name}` : "New category"}
      </h2>

      <form action={formAction} className="mt-4 grid gap-4 sm:grid-cols-2">
        {category ? <input type="hidden" name="id" value={category.id} /> : null}

        <Labelled label="Name">
          <input name="name" defaultValue={category?.name ?? ""} required className={FIELD} />
        </Labelled>
        <Labelled label="Slug" hint="Blank to generate from the name">
          <input name="slug" defaultValue={category?.slug ?? ""} className={FIELD} />
        </Labelled>
        <Labelled label="Description" className="sm:col-span-2">
          <input
            name="description"
            defaultValue={category?.description ?? ""}
            className={FIELD}
          />
        </Labelled>
        <Labelled label="Tile image path" hint="e.g. /assets/images/office/chair-mesh.jpg">
          <input
            name="imagePath"
            defaultValue={category?.imagePath ?? ""}
            className={FIELD}
          />
        </Labelled>
        <Labelled label="Backdrop colour">
          <input
            name="toneHex"
            defaultValue={category?.toneHex ?? ""}
            placeholder="#E6D5BD"
            className={FIELD}
          />
        </Labelled>
        <Labelled label="Display order">
          <input
            name="sortOrder"
            type="number"
            min={0}
            defaultValue={category?.sortOrder ?? 0}
            className={FIELD}
          />
        </Labelled>

        <div className="flex flex-wrap items-end gap-5">
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              name="isActive"
              defaultChecked={category?.isActive ?? true}
              className="h-4 w-4 accent-[var(--color-espresso)]"
            />
            Active
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              name="showOnHomepage"
              defaultChecked={category?.showOnHomepage ?? false}
              className="h-4 w-4 accent-[var(--color-espresso)]"
            />
            Show on homepage
          </label>
        </div>

        {state.error ? (
          <p role="alert" className="sm:col-span-2 text-sm font-semibold text-destructive">
            {state.error}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <button
            type="submit"
            className="rounded-full bg-espresso px-6 py-2.5 text-sm font-bold text-cream hover:bg-walnut"
          >
            Save
          </button>
          <button
            type="button"
            onClick={onDone}
            className="rounded-full border border-line px-5 py-2.5 text-sm font-semibold"
          >
            Cancel
          </button>

          {category ? (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  await deleteCategory(category.id);
                  router.refresh();
                  onDone();
                })
              }
              className="ml-auto text-sm font-semibold text-destructive hover:underline"
            >
              {category.productCount > 0
                ? `Deactivate (holds ${category.productCount})`
                : "Delete"}
            </button>
          ) : null}
        </div>
      </form>
    </section>
  );
}

function Labelled({
  label,
  hint,
  className = "",
  children,
}: {
  label: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.12em] text-text-muted">
        {label}
      </label>
      {children}
      {hint ? <p className="mt-1 text-xs text-text-muted">{hint}</p> : null}
    </div>
  );
}

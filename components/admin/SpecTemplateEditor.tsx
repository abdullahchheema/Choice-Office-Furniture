"use client";

import { Plus, Trash2 } from "lucide-react";
import { useActionState, useState } from "react";

import { FIELD, LABEL, Notice, SubmitButton } from "@/components/admin/form-bits";
import { saveSpecTemplates, type SpecState } from "@/lib/actions/specs";

export type TemplateCategory = {
  id: string;
  name: string;
  templates: { group: string; name: string }[];
};

/**
 * Chooses which specification labels a category usually needs. Chairs want
 * "Seat height" and "Max load"; desks want "Top thickness" and "Cable
 * management"; accessories want something else again. These appear as
 * one-click suggestions in the product's specification builder — suggestions
 * only, never a limit on what a product can list.
 */
export function SpecTemplateEditor({ categories }: { categories: TemplateCategory[] }) {
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const category = categories.find((c) => c.id === categoryId);

  if (!category) return null;

  return (
    <section className="rounded-card border border-line bg-white p-6">
      <h2 className="font-display text-lg font-extrabold text-ink">Specification templates</h2>
      <p className="mt-1 max-w-prose text-xs text-text-muted">
        The usual specification labels for each category. They appear as one-click
        suggestions when editing a product, so chairs, desks and accessories are each
        described with the right vocabulary.
      </p>

      <div className="mt-4 max-w-xs">
        <label htmlFor="template-category" className={LABEL}>
          Category
        </label>
        <select
          id="template-category"
          value={categoryId}
          onChange={(event) => setCategoryId(event.target.value)}
          className={FIELD}
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.templates.length})
            </option>
          ))}
        </select>
      </div>

      {/* Keyed so switching category (or saving) re-seeds the rows cleanly. */}
      <TemplateRows
        key={`${category.id}:${JSON.stringify(category.templates)}`}
        category={category}
      />
    </section>
  );
}

function TemplateRows({ category }: { category: TemplateCategory }) {
  const [rows, setRows] = useState(category.templates);
  const [state, action] = useActionState<SpecState, FormData>(
    saveSpecTemplates.bind(null, category.id),
    {},
  );

  return (
    <form action={action} className="mt-4 space-y-3">
      <input type="hidden" name="templates" value={JSON.stringify(rows)} />

      {rows.length === 0 ? (
        <p className="rounded-md border border-dashed border-line px-4 py-5 text-center text-sm text-text-muted">
          No template for {category.name} yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row, index) => (
            <li key={index} className="grid gap-2 sm:grid-cols-[10rem_1fr_auto]">
              <input
                aria-label="Group"
                value={row.group}
                onChange={(event) =>
                  setRows((list) =>
                    list.map((r, i) => (i === index ? { ...r, group: event.target.value } : r)),
                  )
                }
                placeholder="Group (optional)"
                className={FIELD}
              />
              <input
                aria-label="Label"
                value={row.name}
                onChange={(event) =>
                  setRows((list) =>
                    list.map((r, i) => (i === index ? { ...r, name: event.target.value } : r)),
                  )
                }
                placeholder="Label, e.g. Seat height"
                className={FIELD}
              />
              <button
                type="button"
                aria-label={`Remove ${row.name || "row"}`}
                onClick={() => setRows((list) => list.filter((_, i) => i !== index))}
                className="rounded p-2 text-destructive hover:bg-destructive/10"
              >
                <Trash2 size={15} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="flex items-center gap-1 rounded-full border border-espresso px-4 py-2 text-sm font-bold text-espresso hover:bg-espresso hover:text-cream"
          onClick={() => setRows((list) => [...list, { group: "", name: "" }])}
        >
          <Plus size={14} aria-hidden="true" /> Add label
        </button>
        <SubmitButton>Save template</SubmitButton>
        <Notice error={state.error} message={state.message} />
      </div>
    </form>
  );
}

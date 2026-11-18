"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useActionState, useState } from "react";

import { FIELD, Notice, SubmitButton } from "@/components/admin/form-bits";
import { saveSpecifications, type SpecState } from "@/lib/actions/specs";

export type SpecRowInput = { group: string; name: string; value: string };
export type SpecTemplateRow = { group: string | null; name: string };

/**
 * The specifications builder.
 *
 * Free-form rows of group / label / value, because a chair, a desk and a
 * monitor arm do not share a vocabulary: "Seat height" means nothing on a
 * table and "Top thickness" means nothing on a chair. The category's template
 * offers its usual labels as one-click starting points, but nothing here is
 * limited to them — type any label to add a spec the template never imagined.
 *
 * The same editor serves the whole product and each variant; a variant's rows
 * override a product row of the same label on the product page.
 */
export function SpecsEditor({
  productId,
  variantId = null,
  initial,
  templates,
  inherited = [],
}: {
  productId: string;
  variantId?: string | null;
  initial: SpecRowInput[];
  templates: SpecTemplateRow[];
  /** Product-wide labels, shown as hints on a variant so overrides are obvious. */
  inherited?: { name: string; value: string }[];
}) {
  const [rows, setRows] = useState<SpecRowInput[]>(initial);

  // Re-seed when the saved rows change (see OptionsEditor) without remounting,
  // so the "Specifications saved" confirmation survives the refresh.
  const seed = JSON.stringify(initial);
  const [seeded, setSeeded] = useState(seed);
  if (seed !== seeded) {
    setSeeded(seed);
    setRows(initial);
  }
  const [state, action] = useActionState<SpecState, FormData>(
    saveSpecifications.bind(null, productId, variantId),
    {},
  );

  const used = new Set(rows.map((row) => row.name.trim().toLowerCase()));
  const unused = templates.filter((t) => !used.has(t.name.toLowerCase()));
  const listId = `spec-groups-${variantId ?? "product"}`;
  const groups = [...new Set([...templates.map((t) => t.group).filter(Boolean), ...rows.map((r) => r.group).filter(Boolean)])] as string[];

  const patch = (index: number, change: Partial<SpecRowInput>) =>
    setRows((list) => list.map((row, i) => (i === index ? { ...row, ...change } : row)));

  const move = (index: number, delta: -1 | 1) =>
    setRows((list) => {
      const target = index + delta;
      if (target < 0 || target >= list.length) return list;
      const next = [...list];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="specs" value={JSON.stringify(rows)} />

      {variantId && inherited.length > 0 ? (
        <p className="text-xs text-text-muted">
          Inherited from the product:{" "}
          {inherited.map((spec) => `${spec.name} (${spec.value})`).join(", ")}. A row with
          the same label below replaces it for this variant only.
        </p>
      ) : null}

      {unused.length > 0 ? (
        <div>
          <p className="mb-1.5 text-xs font-bold uppercase tracking-[0.12em] text-text-muted">
            Usual for this category
          </p>
          <div className="flex flex-wrap gap-1.5">
            {unused.map((template) => (
              <button
                key={template.name}
                type="button"
                className="rounded-full border border-dashed border-espresso px-3 py-1 text-xs font-bold text-espresso hover:bg-sand/60"
                onClick={() =>
                  setRows((list) => [
                    ...list,
                    { group: template.group ?? "", name: template.name, value: "" },
                  ])
                }
              >
                + {template.name}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {rows.length === 0 ? (
        <p className="rounded-md border border-dashed border-line px-4 py-5 text-center text-sm text-text-muted">
          No specifications yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row, index) => (
            <li
              key={index}
              className="grid gap-2 rounded-md border border-line bg-cream/50 p-2 sm:grid-cols-[9rem_1fr_1.6fr_auto]"
            >
              <input
                list={listId}
                aria-label="Group"
                value={row.group}
                onChange={(event) => patch(index, { group: event.target.value })}
                placeholder="Group (optional)"
                className={FIELD}
              />
              <input
                aria-label="Label"
                value={row.name}
                onChange={(event) => patch(index, { name: event.target.value })}
                placeholder="Label, e.g. Seat height"
                className={FIELD}
              />
              <input
                aria-label="Value"
                value={row.value}
                onChange={(event) => patch(index, { value: event.target.value })}
                placeholder="Value, e.g. 45–55 cm"
                className={FIELD}
              />
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label="Move up"
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                  className="rounded p-1.5 text-text-muted hover:bg-sand disabled:opacity-30"
                >
                  <ArrowUp size={15} />
                </button>
                <button
                  type="button"
                  aria-label="Move down"
                  disabled={index === rows.length - 1}
                  onClick={() => move(index, 1)}
                  className="rounded p-1.5 text-text-muted hover:bg-sand disabled:opacity-30"
                >
                  <ArrowDown size={15} />
                </button>
                <button
                  type="button"
                  aria-label={`Remove ${row.name || "row"}`}
                  onClick={() => setRows((list) => list.filter((_, i) => i !== index))}
                  className="rounded p-1.5 text-destructive hover:bg-destructive/10"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <datalist id={listId}>
        {groups.map((group) => (
          <option key={group} value={group} />
        ))}
      </datalist>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="flex items-center gap-1 rounded-full border border-espresso px-4 py-2 text-sm font-bold text-espresso hover:bg-espresso hover:text-cream"
          onClick={() => setRows((list) => [...list, { group: "", name: "", value: "" }])}
        >
          <Plus size={14} aria-hidden="true" /> Add specification
        </button>
        <SubmitButton>Save specifications</SubmitButton>
        <Notice error={state.error} message={state.message} />
      </div>
    </form>
  );
}

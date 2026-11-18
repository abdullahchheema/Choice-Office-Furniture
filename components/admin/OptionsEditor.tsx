"use client";

import { Plus, X } from "lucide-react";
import { useActionState, useState } from "react";

import { BTN, FIELD, LABEL, Notice, SubmitButton } from "@/components/admin/form-bits";
import {
  generateProductVariants,
  saveProductOptions,
  type VariantActionState,
} from "@/lib/actions/variants";

export type OptionAttribute = {
  id?: string;
  name: string;
  display: "BUTTONS" | "SWATCHES";
  values: { id?: string; value: string; swatchHex: string }[];
};

/** What generating would do right now — computed on the server from saved options. */
export type GenerationPlan = {
  create: number;
  deleteCount: number;
  deactivateCount: number;
  kept: number;
  total: number;
  /** True when no existing variant can lend its price to the new ones. */
  needsPrice: boolean;
} | null;

const SUGGESTIONS = ["Colour", "Material", "Size", "Configuration", "Finish", "Armrest type"];

/**
 * Defines a variable product's options — Colour, Material, Size, Configuration
 * or anything the admin invents — and turns them into variants.
 *
 * Two deliberate steps: save the option definitions, then generate. Keeping
 * them separate means an admin can add four values, see exactly what would be
 * created ("adds 6, removes 0"), and only then commit — generation can create
 * dozens of rows and should never be a side effect of a text edit.
 */
export function OptionsEditor({
  productId,
  initial,
  plan,
}: {
  productId: string;
  initial: OptionAttribute[];
  plan: GenerationPlan;
}) {
  const [attributes, setAttributes] = useState<OptionAttribute[]>(initial);

  /*
   * After a save the server sends back the options with their new ids, which
   * the next save needs (otherwise they would be re-created and collide). The
   * editor re-seeds from props when they change — adjusting state during render
   * is React's sanctioned way to do that — instead of being remounted with a
   * `key`, which would throw away the "Options saved" confirmation along with
   * the old state.
   */
  const seed = JSON.stringify(initial);
  const [seeded, setSeeded] = useState(seed);
  if (seed !== seeded) {
    setSeeded(seed);
    setAttributes(initial);
  }
  const [saveState, saveAction] = useActionState<VariantActionState, FormData>(
    saveProductOptions.bind(null, productId),
    {},
  );
  const [genState, genAction] = useActionState<VariantActionState, FormData>(
    generateProductVariants.bind(null, productId),
    {},
  );

  const update = (index: number, patch: Partial<OptionAttribute>) =>
    setAttributes((list) => list.map((a, i) => (i === index ? { ...a, ...patch } : a)));

  const updateValue = (
    ai: number,
    vi: number,
    patch: Partial<OptionAttribute["values"][number]>,
  ) =>
    setAttributes((list) =>
      list.map((a, i) =>
        i === ai
          ? { ...a, values: a.values.map((v, j) => (j === vi ? { ...v, ...patch } : v)) }
          : a,
      ),
    );

  const combos = attributes.reduce(
    (n, a) => n * Math.max(1, a.values.filter((v) => v.value.trim()).length),
    attributes.length ? 1 : 0,
  );

  // The payload mirrors the screen exactly; the server validates it again.
  const payload = JSON.stringify(
    attributes.map((a) => ({
      id: a.id,
      name: a.name,
      display: a.display,
      values: a.values
        .filter((v) => v.value.trim())
        .map((v) => ({ id: v.id, value: v.value, swatchHex: v.swatchHex || null })),
    })),
  );

  return (
    <div className="space-y-6">
      <form action={saveAction} className="space-y-4">
        <input type="hidden" name="options" value={payload} />

        {attributes.length === 0 ? (
          <p className="rounded-md border border-dashed border-line px-4 py-6 text-center text-sm text-text-muted">
            No options yet. Add one — for example Colour with Black, Grey and Tan.
          </p>
        ) : null}

        {attributes.map((attribute, ai) => (
          <fieldset key={attribute.id ?? `new-${ai}`} className="rounded-md border border-line p-4">
            <legend className="px-1 text-xs font-bold uppercase tracking-[0.12em] text-text-muted">
              Option {ai + 1}
            </legend>

            <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
              <div>
                <label className={LABEL} htmlFor={`opt-name-${ai}`}>
                  Name
                </label>
                <input
                  id={`opt-name-${ai}`}
                  list="option-name-suggestions"
                  value={attribute.name}
                  onChange={(event) => update(ai, { name: event.target.value })}
                  placeholder="Colour"
                  className={FIELD}
                />
              </div>

              <div>
                <label className={LABEL} htmlFor={`opt-display-${ai}`}>
                  Shown as
                </label>
                <select
                  id={`opt-display-${ai}`}
                  value={attribute.display}
                  onChange={(event) =>
                    update(ai, { display: event.target.value as OptionAttribute["display"] })
                  }
                  className={FIELD}
                >
                  <option value="BUTTONS">Buttons</option>
                  <option value="SWATCHES">Colour swatches</option>
                </select>
              </div>

              <button
                type="button"
                className="rounded-md border border-line px-3 py-2 text-sm font-semibold text-destructive hover:bg-destructive/5"
                onClick={() => setAttributes((list) => list.filter((_, i) => i !== ai))}
              >
                Remove option
              </button>
            </div>

            <ul className="mt-4 flex flex-wrap gap-2">
              {attribute.values.map((value, vi) => (
                <li
                  key={value.id ?? `v-${vi}`}
                  className="flex items-center gap-1.5 rounded-full border border-line bg-cream py-1 pl-3 pr-1.5"
                >
                  {attribute.display === "SWATCHES" ? (
                    <input
                      type="color"
                      aria-label={`Colour for ${value.value || "new value"}`}
                      value={value.swatchHex || "#cccccc"}
                      onChange={(event) => updateValue(ai, vi, { swatchHex: event.target.value })}
                      className="h-6 w-6 cursor-pointer rounded-full border border-line bg-transparent p-0"
                    />
                  ) : null}
                  <input
                    aria-label={`${attribute.name || "Option"} value ${vi + 1}`}
                    value={value.value}
                    onChange={(event) => updateValue(ai, vi, { value: event.target.value })}
                    placeholder="Value"
                    className="w-28 bg-transparent text-sm font-semibold text-espresso outline-none"
                  />
                  <button
                    type="button"
                    aria-label={`Remove ${value.value || "value"}`}
                    className="rounded-full p-1 text-text-muted hover:bg-sand hover:text-destructive"
                    onClick={() =>
                      update(ai, { values: attribute.values.filter((_, j) => j !== vi) })
                    }
                  >
                    <X size={14} />
                  </button>
                </li>
              ))}
              <li>
                <button
                  type="button"
                  className="flex items-center gap-1 rounded-full border border-dashed border-espresso px-3 py-1.5 text-sm font-bold text-espresso hover:bg-sand/60"
                  onClick={() =>
                    update(ai, {
                      values: [...attribute.values, { value: "", swatchHex: "#cccccc" }],
                    })
                  }
                >
                  <Plus size={14} aria-hidden="true" /> Add value
                </button>
              </li>
            </ul>
          </fieldset>
        ))}

        <datalist id="option-name-suggestions">
          {SUGGESTIONS.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className={BTN}
            disabled={attributes.length >= 5}
            onClick={() =>
              setAttributes((list) => [
                ...list,
                { name: "", display: "BUTTONS", values: [{ value: "", swatchHex: "#cccccc" }] },
              ])
            }
          >
            + Add option
          </button>
          <SubmitButton>Save options</SubmitButton>
          {attributes.length > 0 ? (
            <span className="text-xs text-text-muted">
              {combos} combination{combos === 1 ? "" : "s"} once generated
            </span>
          ) : null}
        </div>
        <Notice error={saveState.error} message={saveState.message} />
      </form>

      {/* Generation reads the SAVED options, so the counts always describe
          what the button will really do. */}
      <form
        action={genAction}
        className="rounded-md border border-line bg-cream/60 p-4"
        aria-label="Generate variants"
      >
        <h3 className="text-sm font-bold text-espresso">Generate variants</h3>
        {plan ? (
          <>
            <p className="mt-1 text-sm text-text-muted">
              {plan.total} combination{plan.total === 1 ? "" : "s"} from the saved options:{" "}
              <strong className="text-espresso">{plan.create} new</strong>,{" "}
              {plan.kept} already exist
              {plan.deleteCount + plan.deactivateCount > 0 ? (
                <>
                  , <strong className="text-destructive">
                    {plan.deleteCount} to remove
                  </strong>
                  {plan.deactivateCount > 0
                    ? ` and ${plan.deactivateCount} to deactivate (they have order or stock history)`
                    : ""}
                </>
              ) : null}
              . Existing variants keep their price, stock, SKU and photos.
            </p>

            {plan.needsPrice && plan.create > 0 ? (
              <div className="mt-3 max-w-[14rem]">
                <label className={LABEL} htmlFor="defaultPrice">
                  Starting price
                </label>
                <input
                  id="defaultPrice"
                  name="defaultPrice"
                  inputMode="decimal"
                  placeholder="48500"
                  required
                  className={FIELD}
                />
                <p className="mt-1 text-xs text-text-muted">
                  Every new variant starts here — adjust each one afterwards.
                </p>
              </div>
            ) : null}

            <div className="mt-3">
              <SubmitButton pendingLabel="Generating…">
                {plan.create === 0 && plan.deleteCount + plan.deactivateCount === 0
                  ? "Variants are up to date"
                  : `Generate variants (+${plan.create})`}
              </SubmitButton>
            </div>
          </>
        ) : (
          <p className="mt-1 text-sm text-text-muted">
            Save at least one option with a value first.
          </p>
        )}
        <div className="mt-2">
          <Notice error={genState.error} message={genState.message} />
        </div>
      </form>
    </div>
  );
}

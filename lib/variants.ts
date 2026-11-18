/**
 * Pure variant helpers — no database, no `server-only`, so the admin editor,
 * the storefront selector and the server services all share one definition of
 * what a variant is called and how combinations are formed.
 */

export type OptionPair = { name: string; value: string };

/** "Black / Leather" — the human name of a variant, in attribute order. */
export function variantLabel(options: OptionPair[]): string {
  return options.map((option) => option.value).join(" / ");
}

/**
 * The identity of an option combination, independent of ordering. Two variants
 * with the same signature are the same product configuration, which is what
 * keeps regeneration from creating a second "Black / Leather".
 */
export function signature(valueIds: string[]): string {
  return [...valueIds].sort().join("|");
}

/** Cartesian product of per-attribute value lists, preserving order. */
export function cartesian<T>(lists: T[][]): T[][] {
  if (lists.length === 0) return [];
  return lists.reduce<T[][]>(
    (acc, list) => acc.flatMap((prefix) => list.map((item) => [...prefix, item])),
    [[]],
  );
}

/** "Leather" → "LEA". Letters and digits only, so SKUs stay clean. */
function skuPart(value: string, length = 3): string {
  const cleaned = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return cleaned.slice(0, length) || "X";
}

/**
 * A readable, unique SKU: base code plus a short code per chosen value
 * (CH-EXE-001-TAN-LEA). Collisions — "Leather" and "Leatherette" both being
 * LEA — are resolved by lengthening the codes, then by a numeric suffix, so
 * generation can never fail on a duplicate.
 */
export function buildVariantSku(
  base: string,
  values: string[],
  taken: Set<string>,
): string {
  for (let length = 3; length <= 6; length += 1) {
    const candidate = [base, ...values.map((value) => skuPart(value, length))].join("-");
    if (!taken.has(candidate)) return candidate;
  }
  const stem = [base, ...values.map((value) => skuPart(value, 6))].join("-");
  for (let n = 2; n < 1000; n += 1) {
    const candidate = `${stem}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
  throw new Error("Could not build a unique SKU");
}

export function isHexColour(value: string | null | undefined): value is string {
  return !!value && /^#[0-9a-fA-F]{6}$/.test(value);
}

// ───────────────────────────── specifications ─────────────────────────────

export type SpecRow = { group: string | null; name: string; value: string };

/**
 * A variant's specifications layered over its product's: where a variant
 * defines a spec with the same name (a "Dimensions" for the 160 cm desk, say),
 * it replaces the product-wide one in place; anything new is appended.
 */
export function mergeSpecs(productSpecs: SpecRow[], variantSpecs: SpecRow[]): SpecRow[] {
  const overrides = new Map(variantSpecs.map((spec) => [spec.name.toLowerCase(), spec]));
  const used = new Set<string>();

  const merged = productSpecs.map((spec) => {
    const override = overrides.get(spec.name.toLowerCase());
    if (!override) return spec;
    used.add(spec.name.toLowerCase());
    return { ...override, group: override.group ?? spec.group };
  });

  return [...merged, ...variantSpecs.filter((spec) => !used.has(spec.name.toLowerCase()))];
}

/** Groups in first-seen order; ungrouped specs come first under a null key. */
export function groupSpecs(specs: SpecRow[]): { group: string | null; rows: SpecRow[] }[] {
  const groups = new Map<string | null, SpecRow[]>();
  for (const spec of specs) {
    const key = spec.group || null;
    groups.set(key, [...(groups.get(key) ?? []), spec]);
  }
  return [...groups.entries()]
    .map(([group, rows]) => ({ group, rows }))
    .sort((a, b) => (a.group === null ? -1 : b.group === null ? 1 : 0));
}

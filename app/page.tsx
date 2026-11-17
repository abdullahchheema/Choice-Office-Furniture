/**
 * Phase 1 scaffold check — replaced by the real homepage in Phase 2.
 *
 * It deliberately exercises the three things that must be true before any
 * component work starts:
 *   1. storefront.css loads and its legacy classes still render (.btn, .eyebrow)
 *   2. Tailwind utilities apply AND beat the legacy sheet (the cascade-layer test)
 *   3. The renamed tokens resolve: --text-muted as text, --radius-card at 22px
 */
export default function ScaffoldCheck() {
  return (
    <main className="container" style={{ paddingBlock: "clamp(72px, 11vw, 144px)" }}>
      <p className="eyebrow">Phase 1 · Scaffold</p>
      <h1 style={{ fontSize: "clamp(2.6rem, 5vw, 4rem)" }}>
        Choice Office Furniture <em>is wired up.</em>
      </h1>
      <p className="lede">
        Next.js 16, Tailwind v4 and the ported stylesheet are sharing one set of
        tokens. The real storefront lands in Phase 2.
      </p>

      <section className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["--color-cream", "#F7F1E8"],
          ["--color-oak", "#C8A06E"],
          ["--color-clay", "#8C4F27"],
          ["--color-espresso", "#3B2A1E"],
        ].map(([token, hex]) => (
          <div
            key={token}
            className="rounded-card border p-4"
            style={{ borderColor: "var(--line)", background: "var(--linen)" }}
          >
            <span
              className="block h-12 w-full rounded-md"
              style={{ background: hex }}
            />
            <code className="mt-3 block text-xs">{token}</code>
            <code className="block text-xs" style={{ color: "var(--text-muted)" }}>
              {hex}
            </code>
          </div>
        ))}
      </section>

      <section className="mt-10 flex flex-wrap items-center gap-4">
        <a className="btn btn--primary" href="#">
          Legacy .btn
        </a>
        {/* Cascade test. These utilities carry NO `!important` on purpose — with
            it they would win regardless of layering and prove nothing. Plain
            utilities only beat `.btn` (a class selector, equal specificity) if
            storefront.css really is in layer(components) and Tailwind's
            utilities layer sorts after it. */}
        <a className="btn btn--primary rounded-md px-10" href="#">
          .btn + utilities
        </a>
      </section>

      <p className="mt-10 text-sm" style={{ color: "var(--text-muted)" }}>
        If the second button is wider with tighter corners, the cascade layering
        is correct. If this paragraph is readable brown rather than beige, the{" "}
        <code>--muted</code> collision is resolved.
      </p>
    </main>
  );
}

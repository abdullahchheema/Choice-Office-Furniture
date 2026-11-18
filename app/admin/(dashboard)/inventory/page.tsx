import { StockAdjuster } from "@/components/admin/StockAdjuster";
import { prisma } from "@/lib/prisma";
import { findStockDrift } from "@/lib/services/inventory";

export const metadata = { title: "Inventory" };

export default async function AdminInventoryPage() {
  const [rows, drift, recent] = await Promise.all([
    // Stock is per VARIANT: one row per sellable SKU, not per product.
    prisma.productVariant.findMany({
      where: {
        trackInventory: true,
        isActive: true,
        product: { status: { not: "ARCHIVED" } },
      },
      orderBy: [{ stockQuantity: "asc" }, { sku: "asc" }],
      select: {
        id: true,
        sku: true,
        stockQuantity: true,
        lowStockThreshold: true,
        product: { select: { name: true, type: true } },
        options: {
          select: {
            attribute: { select: { sortOrder: true } },
            value: { select: { value: true } },
          },
        },
      },
    }),
    findStockDrift(),
    prisma.inventoryTransaction.findMany({
      orderBy: { createdAt: "desc" },
      take: 15,
      include: {
        variant: {
          select: {
            sku: true,
            product: { select: { name: true } },
            options: {
              select: {
                attribute: { select: { sortOrder: true } },
                value: { select: { value: true } },
              },
            },
          },
        },
      },
    }),
  ]);

  const labelOf = (options: { attribute: { sortOrder: number }; value: { value: string } }[]) =>
    [...options]
      .sort((a, b) => a.attribute.sortOrder - b.attribute.sortOrder)
      .map((o) => o.value.value)
      .join(" / ");

  const products = rows.map((row) => ({
    id: row.id,
    name: row.product.name,
    variant: labelOf(row.options),
    sku: row.sku,
    stockQuantity: row.stockQuantity,
    lowStockThreshold: row.lowStockThreshold,
  }));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink">
          Inventory
        </h1>
        <p className="mt-1 max-w-prose text-sm text-text-muted">
          Stock is tracked per variant — each colour, size or configuration sells
          out on its own. It moves when an order is confirmed, not when it is
          placed, because a WhatsApp handoff carries no commitment. Every change
          is written to the ledger below.
        </p>
      </header>

      {/* Rows here mean the stock column and its ledger disagree, which the
          design makes impossible — so it is worth shouting about. */}
      <section
        className={`rounded-card border p-5 ${
          drift.length === 0
            ? "border-line bg-white"
            : "border-destructive bg-destructive/5"
        }`}
      >
        <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-text-muted">
          Ledger reconciliation
        </h2>
        {drift.length === 0 ? (
          <p className="mt-2 text-sm font-semibold text-espresso">
            Balanced — every variant’s stock equals the sum of its recorded
            movements.
          </p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm font-semibold text-destructive">
            {drift.map((row) => (
              <li key={row.sku}>
                {row.name} ({row.sku}): stored {row.stored}, ledger{" "}
                {String(row.ledger)}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="overflow-hidden rounded-card border border-line bg-white">
        <h2 className="border-b border-line px-6 py-4 font-display text-lg font-extrabold text-ink">
          Stock levels
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line bg-cream text-xs uppercase tracking-[0.1em] text-text-muted">
              <tr>
                <th scope="col" className="px-6 py-3 font-bold">Product / variant</th>
                <th scope="col" className="px-6 py-3 text-right font-bold">In stock</th>
                <th scope="col" className="px-6 py-3 font-bold">Adjust</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {products.map((product) => {
                const out = product.stockQuantity <= 0;
                const low = !out && product.stockQuantity <= product.lowStockThreshold;
                return (
                  <tr key={product.id}>
                    <td className="px-6 py-3">
                      <span className="block font-semibold text-espresso">
                        {product.name}
                        {product.variant ? (
                          <span className="font-medium text-text-muted"> — {product.variant}</span>
                        ) : null}
                      </span>
                      <span className="font-mono text-xs text-text-muted">
                        {product.sku}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right">
                      <span
                        className={`font-bold ${
                          out ? "text-destructive" : low ? "text-clay" : "text-espresso"
                        }`}
                      >
                        {product.stockQuantity}
                      </span>
                      {out ? (
                        <span className="ml-2 text-xs font-semibold text-destructive">
                          out
                        </span>
                      ) : low ? (
                        <span className="ml-2 text-xs font-semibold text-clay">low</span>
                      ) : null}
                    </td>
                    <td className="px-6 py-3">
                      <StockAdjuster variantId={product.id} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-card border border-line bg-white p-6">
        <h2 className="font-display text-lg font-extrabold text-ink">
          Recent movements
        </h2>
        <ul className="mt-4 divide-y divide-line text-sm">
          {recent.map((entry) => (
            <li key={entry.id} className="flex items-center gap-3 py-2.5">
              <span
                className={`w-12 shrink-0 text-right font-bold ${
                  entry.quantityDelta < 0 ? "text-destructive" : "text-espresso"
                }`}
              >
                {entry.quantityDelta > 0 ? "+" : ""}
                {entry.quantityDelta}
              </span>
              <span className="min-w-0 flex-1 truncate">
                <span className="font-semibold text-espresso">
                  {entry.variant.product.name}
                  {labelOf(entry.variant.options) ? ` — ${labelOf(entry.variant.options)}` : ""}
                </span>
                <span className="font-mono text-xs text-text-muted"> {entry.variant.sku}</span>
                <span className="text-text-muted">
                  {" "}
                  · {entry.reason.toLowerCase().replace(/_/g, " ")}
                </span>
              </span>
              <span className="shrink-0 text-xs text-text-muted">
                → {entry.resultingQuantity}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

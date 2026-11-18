import "server-only";

import type { InventoryReason, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

/**
 * The ONLY place `Product.stockQuantity` is written.
 *
 * Every change moves the column and appends a ledger row in the same
 * transaction, which is what keeps this query returning nothing:
 *
 *   SELECT … FROM products p LEFT JOIN inventory_transactions t …
 *   HAVING p."stockQuantity" <> COALESCE(SUM(t."quantityDelta"), 0)
 *
 * No other module may call `prisma.product.update({ data: { stockQuantity } })`.
 * If it does, stock and its audit trail drift apart silently and nothing
 * catches it until someone counts the warehouse.
 */
export async function adjustStock({
  productId,
  delta,
  reason,
  note,
  adminId,
  orderId,
  tx,
}: {
  productId: string;
  delta: number;
  reason: InventoryReason;
  note?: string;
  adminId?: string;
  orderId?: string;
  /** Pass an existing transaction when this is part of a larger atomic change. */
  tx?: Prisma.TransactionClient;
}): Promise<{ resultingQuantity: number }> {
  const run = async (client: Prisma.TransactionClient) => {
    // Lock the row first: two concurrent adjustments must serialise, or both
    // read the same starting figure and one of them is lost.
    const rows = await client.$queryRaw<
      { stockQuantity: number; trackInventory: boolean; name: string }[]
    >`
      SELECT "stockQuantity", "trackInventory", "name"
      FROM products WHERE id = ${productId} FOR UPDATE
    `;

    const product = rows[0];
    if (!product) throw new Error("Product not found");

    const next = product.stockQuantity + delta;
    if (next < 0) {
      throw new InsufficientStockError(product.name, product.stockQuantity, -delta);
    }

    await client.product.update({
      where: { id: productId },
      // Absolute, computed under the lock — not a relative increment, so the
      // value written is the one the ledger row records.
      data: { stockQuantity: next },
    });

    await client.inventoryTransaction.create({
      data: {
        productId,
        quantityDelta: delta,
        reason,
        resultingQuantity: next,
        note: note ?? null,
        createdById: adminId ?? null,
        orderId: orderId ?? null,
      },
    });

    return { resultingQuantity: next };
  };

  return tx
    ? run(tx)
    : prisma.$transaction(run, { timeout: 15_000, maxWait: 5_000 });
}

export class InsufficientStockError extends Error {
  constructor(
    public readonly productName: string,
    public readonly available: number,
    public readonly requested: number,
  ) {
    super(
      `${productName}: only ${available} in stock, ${requested} requested`,
    );
    this.name = "InsufficientStockError";
  }
}

/** Rows here mean stock and its ledger disagree, which should be impossible. */
export async function findStockDrift() {
  return prisma.$queryRaw<
    { sku: string; name: string; stored: number; ledger: bigint }[]
  >`
    SELECT p.sku, p.name, p."stockQuantity" AS stored,
           COALESCE(SUM(t."quantityDelta"), 0) AS ledger
    FROM products p
    LEFT JOIN inventory_transactions t ON t."productId" = p.id
    GROUP BY p.id
    HAVING p."stockQuantity" <> COALESCE(SUM(t."quantityDelta"), 0)
  `;
}

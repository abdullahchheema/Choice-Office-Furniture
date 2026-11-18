import "server-only";

import type { InventoryReason, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

/**
 * The ONLY place `ProductVariant.stockQuantity` is written.
 *
 * Stock is tracked per variant — a black chair and a grey chair sell out
 * independently. Every change moves the column and appends a ledger row in the
 * same transaction, which is what keeps this query returning nothing:
 *
 *   SELECT … FROM product_variants v LEFT JOIN inventory_transactions t …
 *   HAVING v."stockQuantity" <> COALESCE(SUM(t."quantityDelta"), 0)
 *
 * No other module may write `stockQuantity`. If it does, stock and its audit
 * trail drift apart silently and nothing catches it until someone counts the
 * warehouse.
 */
export async function adjustStock({
  variantId,
  delta,
  reason,
  note,
  adminId,
  orderId,
  tx,
}: {
  variantId: string;
  delta: number;
  reason: InventoryReason;
  note?: string;
  adminId?: string;
  orderId?: string;
  /** Pass an existing transaction when this is part of a larger atomic change. */
  tx?: Prisma.TransactionClient;
}): Promise<{ resultingQuantity: number }> {
  const run = async (client: Prisma.TransactionClient) => {
    // Lock the variant row first: two concurrent adjustments must serialise, or
    // both read the same starting figure and one of them is lost.
    const rows = await client.$queryRaw<
      { stockQuantity: number; sku: string; name: string }[]
    >`
      SELECT v."stockQuantity", v."sku", p."name"
      FROM product_variants v
      JOIN products p ON p."id" = v."productId"
      WHERE v."id" = ${variantId}
      FOR UPDATE OF v
    `;

    const variant = rows[0];
    if (!variant) throw new Error("Variant not found");

    const next = variant.stockQuantity + delta;
    if (next < 0) {
      throw new InsufficientStockError(
        `${variant.name} (${variant.sku})`,
        variant.stockQuantity,
        -delta,
      );
    }

    await client.productVariant.update({
      where: { id: variantId },
      // Absolute, computed under the lock — not a relative increment, so the
      // value written is the one the ledger row records.
      data: { stockQuantity: next },
    });

    await client.inventoryTransaction.create({
      data: {
        variantId,
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
    SELECT v.sku, p.name, v."stockQuantity" AS stored,
           COALESCE(SUM(t."quantityDelta"), 0) AS ledger
    FROM product_variants v
    JOIN products p ON p.id = v."productId"
    LEFT JOIN inventory_transactions t ON t."variantId" = v.id
    GROUP BY v.id, p.name
    HAVING v."stockQuantity" <> COALESCE(SUM(t."quantityDelta"), 0)
  `;
}

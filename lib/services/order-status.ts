import "server-only";

import type { OrderStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { InsufficientStockError, adjustStock } from "@/lib/services/inventory";

/** Which moves are legal. Delivered and Cancelled are terminal. */
export const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING_CONFIRMATION: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["READY_FOR_DISPATCH", "CANCELLED"],
  READY_FOR_DISPATCH: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED", "CANCELLED"],
  DELIVERED: [],
  CANCELLED: [],
};

export class IllegalTransitionError extends Error {
  constructor(from: OrderStatus, to: OrderStatus) {
    super(`Cannot move an order from ${from} to ${to}`);
    this.name = "IllegalTransitionError";
  }
}

/**
 * The single path for changing an order's status, and therefore the only
 * place an order moves stock.
 *
 * Stock leaves on the way into CONFIRMED and comes back if a confirmed order
 * is cancelled. It deliberately does NOT move at checkout: a WhatsApp handoff
 * carries no payment and no commitment, so counting it would let abandoned
 * submissions mark sellable chairs out of stock, with no payment event to
 * release the hold against.
 *
 * Three independent defences stop a double-click double-decrementing:
 *
 *   1. SELECT … FOR UPDATE on the order row. The second caller blocks, then
 *      re-reads the already-updated status and takes the no-op branch.
 *   2. The `stockCommitted` flag, so the effect depends on a dedicated boolean
 *      rather than being inferred from the status enum.
 *   3. A unique index on (orderId, productId, reason). If 1 and 2 are ever
 *      defeated by a code change, the insert throws and the whole transaction
 *      rolls back — a loud failure instead of silent stock drift.
 */
export async function changeOrderStatus({
  orderId,
  to,
  admin,
  note,
}: {
  orderId: string;
  to: OrderStatus;
  admin: { id: string; name: string };
  note?: string;
}): Promise<{ noop: boolean }> {
  return prisma.$transaction(
    async (tx) => {
      const rows = await tx.$queryRaw<
        { id: string; status: OrderStatus; stockCommitted: boolean }[]
      >`
        SELECT id, status, "stockCommitted" FROM orders
        WHERE id = ${orderId} FOR UPDATE
      `;

      const order = rows[0];
      if (!order) throw new Error("Order not found");

      // Idempotent: asking for the status it already has is not an error.
      if (order.status === to) return { noop: true };
      if (!ALLOWED_TRANSITIONS[order.status].includes(to)) {
        throw new IllegalTransitionError(order.status, to);
      }

      const needsDecrement = to === "CONFIRMED" && !order.stockCommitted;
      const needsRestore = to === "CANCELLED" && order.stockCommitted;

      if (needsDecrement || needsRestore) {
        const items = await tx.orderItem.findMany({
          where: { orderId, productId: { not: null } },
          select: { productId: true, quantity: true },
        });

        /*
         * Sorted ids give every transaction the same lock order. Without it,
         * two concurrent multi-product orders can take locks in opposite
         * orders and deadlock.
         */
        const sorted = [...items].sort((a, b) =>
          (a.productId ?? "").localeCompare(b.productId ?? ""),
        );

        for (const item of sorted) {
          if (!item.productId) continue;
          await adjustStock({
            tx,
            productId: item.productId,
            delta: needsDecrement ? -item.quantity : item.quantity,
            reason: needsDecrement ? "ORDER_CONFIRMED" : "ORDER_CANCELLED",
            orderId,
            adminId: admin.id,
          });
        }
      }

      await tx.order.update({
        where: { id: orderId },
        data: {
          status: to,
          stockCommitted: needsDecrement
            ? true
            : needsRestore
              ? false
              : undefined,
          confirmedAt: to === "CONFIRMED" ? new Date() : undefined,
          cancelledAt: to === "CANCELLED" ? new Date() : undefined,
          cancelReason: to === "CANCELLED" ? (note ?? null) : undefined,
        },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId,
          fromStatus: order.status,
          toStatus: to,
          note: note ?? null,
          changedById: admin.id,
          changedByLabel: admin.name,
        },
      });

      return { noop: false };
    },
    // Generous, because this holds row locks across several round trips and
    // Supabase's shared compute can be slow to wake.
    { timeout: 15_000, maxWait: 5_000 },
  );
}

export { InsufficientStockError };

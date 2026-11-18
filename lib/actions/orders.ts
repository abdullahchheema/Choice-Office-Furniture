"use server";

import type { OrderStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { InsufficientStockError } from "@/lib/services/inventory";
import {
  IllegalTransitionError,
  changeOrderStatus,
} from "@/lib/services/order-status";

export type OrderActionState = { error?: string; message?: string };

export async function advanceOrder(
  orderId: string,
  _previous: OrderActionState,
  formData: FormData,
): Promise<OrderActionState> {
  const admin = await requireAdmin();

  const to = String(formData.get("status") ?? "") as OrderStatus;
  const note = String(formData.get("note") ?? "").trim() || undefined;

  try {
    const result = await changeOrderStatus({ orderId, to, admin, note });
    revalidatePath(`/admin/orders/${orderId}`);
    revalidatePath("/admin/orders");
    revalidatePath("/admin");
    return {
      message: result.noop
        ? "That order was already at this status."
        : "Status updated.",
    };
  } catch (error) {
    // These two are expected outcomes with something useful to say, not bugs.
    if (error instanceof InsufficientStockError) {
      return {
        error: `Not enough stock to confirm: ${error.message}. Adjust inventory first.`,
      };
    }
    if (error instanceof IllegalTransitionError) {
      return { error: error.message };
    }
    console.error("[admin] order status change failed", error);
    return { error: "Could not update the order. The error has been logged." };
  }
}

export async function addOrderNote(
  orderId: string,
  _previous: OrderActionState,
  formData: FormData,
): Promise<OrderActionState> {
  await requireAdmin();
  const note = String(formData.get("adminNote") ?? "").trim();

  await prisma.order.update({
    where: { id: orderId },
    data: { adminNote: note || null },
  });

  revalidatePath(`/admin/orders/${orderId}`);
  return { message: "Note saved." };
}

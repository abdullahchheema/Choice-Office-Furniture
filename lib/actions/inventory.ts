"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth/guard";
import { InsufficientStockError, adjustStock } from "@/lib/services/inventory";

export async function adjustStockAction(
  productId: string,
  delta: number,
): Promise<{ error?: string } | void> {
  const admin = await requireAdmin();

  if (!Number.isInteger(delta) || delta === 0) {
    return { error: "Enter a whole number" };
  }

  try {
    await adjustStock({
      productId,
      delta,
      reason: "MANUAL_ADJUSTMENT",
      note: "Adjusted from the inventory screen",
      adminId: admin.id,
    });
  } catch (error) {
    if (error instanceof InsufficientStockError) {
      return { error: `Only ${error.available} in stock` };
    }
    console.error("[admin] stock adjustment failed", error);
    return { error: "Could not adjust stock" };
  }

  revalidatePath("/admin/inventory");
  revalidatePath("/admin");
  revalidatePath("/");
}

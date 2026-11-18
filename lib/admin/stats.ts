import "server-only";

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

/**
 * Dashboard statistics.
 *
 * Everything here is a real aggregate. No placeholder numbers: a dashboard
 * that shows invented figures is worse than one that shows zeros, because a
 * zero is information and a fake number is a lie you act on.
 */
export async function getDashboardStats() {
  const [
    totalProducts,
    publishedProducts,
    outOfStock,
    lowStock,
    totalCategories,
    totalCustomers,
    ordersByStatus,
    revenue,
    recentOrders,
    bestSellers,
  ] = await Promise.all([
    prisma.product.count(),
    prisma.product.count({ where: { status: "PUBLISHED" } }),
    prisma.product.count({
      where: { trackInventory: true, stockQuantity: { lte: 0 } },
    }),
    prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::bigint AS count FROM products
      WHERE "trackInventory" = true
        AND "stockQuantity" > 0
        AND "stockQuantity" <= "lowStockThreshold"
    `,
    prisma.category.count({ where: { isActive: true } }),
    prisma.customer.count(),
    prisma.order.groupBy({ by: ["status"], _count: { _all: true } }),
    /*
     * Revenue counts only orders the shop has actually committed to. A
     * PENDING_CONFIRMATION order is a lead — someone filled in a form — and
     * counting it as money would overstate the figure the owner plans against.
     */
    prisma.order.aggregate({
      _sum: { total: true },
      where: { status: { in: ["CONFIRMED", "PROCESSING", "READY_FOR_DISPATCH", "SHIPPED", "DELIVERED"] } },
    }),
    prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true,
        orderNumber: true,
        customerName: true,
        total: true,
        status: true,
        createdAt: true,
        itemCount: true,
      },
    }),
    prisma.orderItem.groupBy({
      by: ["productName", "productSku"],
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 5,
    }),
  ]);

  const statusCounts = Object.fromEntries(
    ordersByStatus.map((row) => [row.status, row._count._all]),
  ) as Record<string, number>;

  const totalOrders = ordersByStatus.reduce(
    (sum, row) => sum + row._count._all,
    0,
  );

  return {
    totalProducts,
    publishedProducts,
    outOfStock,
    lowStock: Number(lowStock[0]?.count ?? 0),
    totalCategories,
    totalCustomers,
    totalOrders,
    statusCounts,
    revenue: revenue._sum.total ?? new Prisma.Decimal(0),
    recentOrders,
    bestSellers,
  };
}

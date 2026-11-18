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
    // Counted per VARIANT: a chair that is out in black but in stock in grey
    // is one sold-out SKU, not a sold-out product. Archived products and
    // deactivated variants are not stock the shop is trying to sell.
    prisma.productVariant.count({
      where: {
        trackInventory: true,
        isActive: true,
        stockQuantity: { lte: 0 },
        product: { status: { not: "ARCHIVED" } },
      },
    }),
    prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::bigint AS count
      FROM product_variants v
      JOIN products p ON p.id = v."productId"
      WHERE v."trackInventory" = true
        AND v."isActive" = true
        AND p.status <> 'ARCHIVED'
        AND v."stockQuantity" > 0
        AND v."stockQuantity" <= v."lowStockThreshold"
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
      by: ["productName", "productSku", "variantLabel"],
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

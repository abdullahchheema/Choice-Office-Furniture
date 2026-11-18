import type { Prisma } from "@prisma/client";
import Link from "next/link";

import { formatMoney } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { getSettingsOrNull } from "@/lib/queries";
import { safeQuery } from "@/lib/safe";

export const metadata = { title: "Orders" };

const STATUSES = [
  "PENDING_CONFIRMATION",
  "CONFIRMED",
  "PROCESSING",
  "READY_FOR_DISPATCH",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
] as const;

const LABELS: Record<string, string> = {
  PENDING_CONFIRMATION: "Pending",
  CONFIRMED: "Confirmed",
  PROCESSING: "Processing",
  READY_FOR_DISPATCH: "Ready",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const status = STATUSES.find((value) => value === params.status);

  const where: Prisma.OrderWhereInput = {
    ...(query
      ? {
          OR: [
            { orderNumber: { contains: query, mode: "insensitive" } },
            { customerName: { contains: query, mode: "insensitive" } },
            { customerPhone: { contains: query } },
          ],
        }
      : {}),
    ...(status ? { status } : {}),
  };

  const data = await safeQuery(
    "admin orders",
    async () => {
      const [orders, settings] = await Promise.all([
        prisma.order.findMany({
          where,
          orderBy: { createdAt: "desc" },
          take: 50,
        }),
        getSettingsOrNull(),
      ]);
      return { orders, symbol: settings?.currencySymbol ?? "Rs." };
    },
    { orders: [], symbol: "Rs." },
  );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink">
          Orders
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          Every checkout is written here before the customer reaches WhatsApp,
          so an abandoned handoff is still a lead you can call.
        </p>
      </header>

      <form method="get" className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Order number, name or phone…"
          aria-label="Search orders"
          className="min-w-[16rem] flex-1 rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus-visible:border-clay"
        />
        <select
          name="status"
          defaultValue={params.status ?? ""}
          aria-label="Filter by status"
          className="rounded-md border border-line bg-white px-3 py-2 text-sm"
        >
          <option value="">All statuses</option>
          {STATUSES.map((value) => (
            <option key={value} value={value}>
              {LABELS[value]}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-full border border-espresso px-4 py-2 text-sm font-bold text-espresso hover:bg-espresso hover:text-cream"
        >
          Filter
        </button>
      </form>

      <div className="overflow-hidden rounded-card border border-line bg-white">
        {data.orders.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm font-semibold text-espresso">No orders yet</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-text-muted">
              Orders appear the moment a customer submits checkout. Nothing is
              invented here — the list stays empty until one is placed.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-cream text-xs uppercase tracking-[0.1em] text-text-muted">
                <tr>
                  <th scope="col" className="px-4 py-3 font-bold">Order</th>
                  <th scope="col" className="px-4 py-3 font-bold">Customer</th>
                  <th scope="col" className="px-4 py-3 font-bold">Placed</th>
                  <th scope="col" className="px-4 py-3 text-right font-bold">Items</th>
                  <th scope="col" className="px-4 py-3 text-right font-bold">Total</th>
                  <th scope="col" className="px-4 py-3 font-bold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.orders.map((order) => (
                  <tr key={order.id} className="hover:bg-cream/60">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/orders/${order.id}`}
                        className="font-mono text-xs font-bold text-espresso hover:text-clay"
                      >
                        {order.orderNumber}
                      </Link>
                      {!order.whatsappOpenedAt &&
                      order.status === "PENDING_CONFIRMATION" ? (
                        <span
                          className="ml-2 rounded-full bg-sand px-2 py-0.5 text-[0.65rem] font-bold text-espresso"
                          title="The customer never opened WhatsApp — worth a call"
                        >
                          not contacted
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <span className="block font-semibold text-espresso">
                        {order.customerName}
                      </span>
                      <span className="text-xs text-text-muted">
                        {order.customerPhone}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-text-muted">
                      {order.createdAt.toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-3 text-right">{order.itemCount}</td>
                    <td className="px-4 py-3 text-right font-semibold">
                      {formatMoney(order.total, data.symbol)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-linen px-2.5 py-1 text-[0.7rem] font-bold uppercase tracking-wide text-espresso">
                        {LABELS[order.status]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

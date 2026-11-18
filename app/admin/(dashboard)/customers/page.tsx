import { MessageCircle } from "lucide-react";
import Link from "next/link";

import { formatMoney } from "@/lib/money";
import { whatsappDialNumber } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import { getSettingsOrNull } from "@/lib/queries";

export const metadata = { title: "Customers" };

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const query = (await searchParams).q?.trim() ?? "";

  const [customers, settings] = await Promise.all([
    prisma.customer.findMany({
      where: query
        ? {
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { phoneRaw: { contains: query } },
              { phoneE164: { contains: query } },
            ],
          }
        : undefined,
      orderBy: { lastOrderAt: "desc" },
      take: 50,
      include: {
        orders: { select: { total: true, status: true } },
      },
    }),
    getSettingsOrNull(),
  ]);

  const symbol = settings?.currencySymbol ?? "Rs.";

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink">
          Customers
        </h1>
        <p className="mt-1 max-w-prose text-sm text-text-muted">
          Created automatically at checkout and matched on phone number, so a
          repeat buyer accumulates history instead of becoming a second record.
        </p>
      </header>

      <form method="get">
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Search name or phone…"
          aria-label="Search customers"
          className="w-full max-w-md rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus-visible:border-clay"
        />
      </form>

      <div className="overflow-hidden rounded-card border border-line bg-white">
        {customers.length === 0 ? (
          <p className="p-10 text-center text-sm text-text-muted">
            No customers yet. The first one is created when an order is placed.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-cream text-xs uppercase tracking-[0.1em] text-text-muted">
                <tr>
                  <th scope="col" className="px-6 py-3 font-bold">Customer</th>
                  <th scope="col" className="px-6 py-3 font-bold">City</th>
                  <th scope="col" className="px-6 py-3 text-right font-bold">Orders</th>
                  <th scope="col" className="px-6 py-3 text-right font-bold">Spent</th>
                  <th scope="col" className="px-6 py-3 font-bold">Last order</th>
                  <th scope="col" className="px-6 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {customers.map((customer) => {
                  // Only committed orders count toward lifetime value; a
                  // pending one is a lead, not revenue.
                  const spent = customer.orders
                    .filter((order) => order.status !== "PENDING_CONFIRMATION" && order.status !== "CANCELLED")
                    .reduce((sum, order) => sum + Number(order.total), 0);
                  return (
                    <tr key={customer.id} className="hover:bg-cream/60">
                      <td className="px-6 py-3">
                        <span className="block font-semibold text-espresso">
                          {customer.name}
                        </span>
                        <span className="text-xs text-text-muted">
                          {customer.phoneRaw}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-text-muted">
                        {customer.city ?? "—"}
                      </td>
                      <td className="px-6 py-3 text-right">{customer.orderCount}</td>
                      <td className="px-6 py-3 text-right font-semibold">
                        {formatMoney(spent, symbol)}
                      </td>
                      <td className="px-6 py-3 text-xs text-text-muted">
                        {customer.lastOrderAt
                          ? customer.lastOrderAt.toLocaleDateString("en-GB")
                          : "—"}
                      </td>
                      <td className="px-6 py-3 text-right">
                        <Link
                          href={`https://wa.me/${whatsappDialNumber(customer.phoneE164)}`}
                          target="_blank"
                          rel="noopener"
                          aria-label={`Message ${customer.name} on WhatsApp`}
                          className="inline-flex text-clay hover:text-espresso"
                        >
                          <MessageCircle size={16} />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

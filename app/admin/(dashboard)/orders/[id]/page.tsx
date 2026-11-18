import { MessageCircle } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { OrderStatusForm } from "@/components/admin/OrderStatusForm";
import { formatMoney } from "@/lib/money";
import { whatsappDialNumber } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import { getSettingsOrNull } from "@/lib/queries";
import { ALLOWED_TRANSITIONS } from "@/lib/services/order-status";

export const metadata = { title: "Order" };

export default async function AdminOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [order, settings] = await Promise.all([
    prisma.order.findUnique({
      where: { id },
      include: {
        items: { orderBy: { createdAt: "asc" } },
        history: { orderBy: { createdAt: "desc" } },
      },
    }),
    getSettingsOrNull(),
  ]);

  if (!order) notFound();
  const symbol = settings?.currencySymbol ?? "Rs.";

  return (
    <div className="space-y-6">
      <header>
        <Link
          href="/admin/orders"
          className="text-sm font-semibold text-text-muted hover:text-clay"
        >
          ← Orders
        </Link>
        <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-ink">
          {order.orderNumber}
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          Placed {order.createdAt.toLocaleString("en-GB")}
          {order.whatsappOpenedAt
            ? " · WhatsApp opened"
            : " · never opened in WhatsApp"}
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          <section className="overflow-hidden rounded-card border border-line bg-white">
            <h2 className="border-b border-line px-6 py-4 font-display text-lg font-extrabold text-ink">
              Items
            </h2>
            <table className="w-full text-left text-sm">
              <tbody className="divide-y divide-line">
                {order.items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-6 py-3">
                      <span className="block font-semibold text-espresso">
                        {item.productName}
                      </span>
                      {/* The snapshot, not a live lookup — this is what was
                          ordered, at the price it was ordered for. */}
                      <span className="font-mono text-xs text-text-muted">
                        {item.productSku} · {item.categoryName}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right text-text-muted">
                      {formatMoney(item.unitPrice, symbol)} × {item.quantity}
                    </td>
                    <td className="px-6 py-3 text-right font-semibold">
                      {formatMoney(item.lineTotal, symbol)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-line bg-cream">
                <tr>
                  <td className="px-6 py-2 text-text-muted" colSpan={2}>
                    Subtotal
                  </td>
                  <td className="px-6 py-2 text-right">
                    {formatMoney(order.subtotal, symbol)}
                  </td>
                </tr>
                <tr>
                  <td className="px-6 py-2 text-text-muted" colSpan={2}>
                    Delivery
                  </td>
                  <td className="px-6 py-2 text-right">
                    {Number(order.shippingFee) === 0
                      ? "Free"
                      : formatMoney(order.shippingFee, symbol)}
                  </td>
                </tr>
                <tr className="font-display text-lg font-extrabold text-ink">
                  <td className="px-6 py-3" colSpan={2}>
                    Total
                  </td>
                  <td className="px-6 py-3 text-right">
                    {formatMoney(order.total, symbol)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </section>

          <section className="rounded-card border border-line bg-white p-6">
            <h2 className="font-display text-lg font-extrabold text-ink">History</h2>
            <ol className="mt-4 space-y-3">
              {order.history.map((entry) => (
                <li key={entry.id} className="text-sm">
                  <span className="font-semibold text-espresso">
                    {entry.fromStatus ? `${entry.fromStatus} → ` : ""}
                    {entry.toStatus}
                  </span>
                  <span className="block text-xs text-text-muted">
                    {entry.createdAt.toLocaleString("en-GB")} ·{" "}
                    {entry.changedByLabel}
                    {entry.note ? ` · ${entry.note}` : ""}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="rounded-card border border-line bg-white p-6">
            <h2 className="font-display text-lg font-extrabold text-ink">Customer</h2>
            <p className="mt-3 text-sm font-semibold text-espresso">
              {order.customerName}
            </p>
            <p className="text-sm text-text-muted">{order.customerPhone}</p>
            {order.customerEmail ? (
              <p className="text-sm text-text-muted">{order.customerEmail}</p>
            ) : null}
            <p className="mt-3 text-sm text-text-muted">
              {order.shippingAddress}
              <br />
              {order.shippingCity}
            </p>
            {order.customerNote ? (
              <p className="mt-3 rounded-md bg-cream px-3 py-2 text-sm text-espresso">
                “{order.customerNote}”
              </p>
            ) : null}

            <a
              href={`https://wa.me/${whatsappDialNumber(order.customerPhoneE164)}`}
              target="_blank"
              rel="noopener"
              className="mt-4 inline-flex items-center gap-2 rounded-full border border-espresso px-4 py-2 text-sm font-bold text-espresso hover:bg-espresso hover:text-cream"
            >
              <MessageCircle size={15} aria-hidden="true" />
              Message on WhatsApp
            </a>
          </section>

          <section className="rounded-card border border-line bg-white p-6">
            <h2 className="mb-4 font-display text-lg font-extrabold text-ink">
              Status
            </h2>
            <OrderStatusForm
              orderId={order.id}
              current={order.status}
              allowed={ALLOWED_TRANSITIONS[order.status]}
              stockCommitted={order.stockCommitted}
            />
          </section>
        </aside>
      </div>
    </div>
  );
}

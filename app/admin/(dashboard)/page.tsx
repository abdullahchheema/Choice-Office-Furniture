import { AlertTriangle, Package, ReceiptText, Users } from "lucide-react";
import Link from "next/link";

import { getDashboardStats } from "@/lib/admin/stats";
import { formatMoney } from "@/lib/money";
import { getSettingsOrNull } from "@/lib/queries";
import { safeQuery } from "@/lib/safe";

export const metadata = { title: "Overview" };

const STATUS_LABELS: Record<string, string> = {
  PENDING_CONFIRMATION: "Pending confirmation",
  CONFIRMED: "Confirmed",
  PROCESSING: "Processing",
  READY_FOR_DISPATCH: "Ready for dispatch",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

export default async function AdminOverviewPage() {
  const [stats, settings] = await Promise.all([
    safeQuery("dashboard stats", getDashboardStats, null),
    safeQuery("settings", getSettingsOrNull, null),
  ]);

  if (!stats) {
    return (
      <Panel>
        <h1 className="font-display text-2xl font-extrabold text-ink">Overview</h1>
        <p className="mt-2 text-sm text-text-muted">
          The database is unreachable, so there is nothing to report. Check the
          connection strings in <code>.env.local</code>.
        </p>
      </Panel>
    );
  }

  const symbol = settings?.currencySymbol ?? "Rs.";
  const pending = stats.statusCounts.PENDING_CONFIRMATION ?? 0;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink">
          Overview
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          Live figures from the database — nothing here is a placeholder.
        </p>
      </header>

      {pending > 0 ? (
        <Link
          href="/admin/orders"
          className="flex items-center gap-3 rounded-card border border-clay/40 bg-sand/40 px-5 py-4 transition-colors hover:bg-sand/60"
        >
          <AlertTriangle size={20} className="shrink-0 text-clay" aria-hidden="true" />
          <span className="text-sm font-semibold text-espresso">
            {pending} {pending === 1 ? "order needs" : "orders need"} confirming
          </span>
        </Link>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Revenue"
          value={formatMoney(stats.revenue, symbol)}
          hint="Confirmed orders and beyond"
          icon={ReceiptText}
        />
        <Stat
          label="Orders"
          value={String(stats.totalOrders)}
          hint={`${pending} awaiting confirmation`}
          icon={ReceiptText}
        />
        <Stat
          label="Published products"
          value={String(stats.publishedProducts)}
          hint={`${stats.totalProducts} total · ${stats.totalCategories} categories`}
          icon={Package}
        />
        <Stat
          label="Customers"
          value={String(stats.totalCustomers)}
          hint="Created automatically at checkout"
          icon={Users}
        />
      </section>

      {(stats.outOfStock > 0 || stats.lowStock > 0) && (
        <section className="grid gap-4 sm:grid-cols-2">
          {stats.outOfStock > 0 && (
            <Panel>
              <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-clay">
                Variants out of stock
              </h2>
              <p className="mt-2 font-display text-3xl font-extrabold text-ink">
                {stats.outOfStock}
              </p>
              <Link
                href="/admin/inventory"
                className="mt-2 inline-block text-sm font-semibold text-clay underline"
              >
                Review inventory
              </Link>
            </Panel>
          )}
          {stats.lowStock > 0 && (
            <Panel>
              <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-clay">
                Variants low on stock
              </h2>
              <p className="mt-2 font-display text-3xl font-extrabold text-ink">
                {stats.lowStock}
              </p>
              <p className="mt-2 text-sm text-text-muted">
                At or below their reorder threshold
              </p>
            </Panel>
          )}
        </section>
      )}

      <section className="grid gap-6 lg:grid-cols-2">
        <Panel>
          <h2 className="font-display text-xl font-extrabold text-ink">
            Recent orders
          </h2>
          {stats.recentOrders.length === 0 ? (
            <p className="mt-3 text-sm text-text-muted">
              No orders yet. They appear here the moment a customer checks out —
              before they reach WhatsApp.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-line">
              {stats.recentOrders.map((order) => (
                <li key={order.id} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/admin/orders/${order.id}`}
                      className="block truncate text-sm font-bold text-espresso hover:text-clay"
                    >
                      {order.orderNumber}
                    </Link>
                    <p className="truncate text-xs text-text-muted">
                      {order.customerName} · {order.itemCount}{" "}
                      {order.itemCount === 1 ? "item" : "items"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-espresso">
                      {formatMoney(order.total, symbol)}
                    </p>
                    <p className="text-xs text-text-muted">
                      {STATUS_LABELS[order.status] ?? order.status}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel>
          <h2 className="font-display text-xl font-extrabold text-ink">
            Best sellers
          </h2>
          {stats.bestSellers.length === 0 ? (
            <p className="mt-3 text-sm text-text-muted">
              Nothing sold yet. This ranks by units actually ordered, so it
              stays empty until the first order is placed.
            </p>
          ) : (
            <ol className="mt-4 space-y-2">
              {stats.bestSellers.map((row, index) => (
                <li
                  key={row.productSku}
                  className="flex items-center gap-3 text-sm"
                >
                  <span className="font-display text-base font-extrabold text-clay">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-semibold text-espresso">
                    {row.productName}
                    {row.variantLabel ? (
                      <span className="font-medium text-text-muted"> — {row.variantLabel}</span>
                    ) : null}
                  </span>
                  <span className="text-text-muted">
                    {row._sum.quantity ?? 0} sold
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </section>

      <Panel>
        <h2 className="font-display text-xl font-extrabold text-ink">
          Orders by status
        </h2>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Object.entries(STATUS_LABELS).map(([status, label]) => (
            <div
              key={status}
              className="rounded-md border border-line bg-cream px-3 py-2.5"
            >
              <dt className="text-xs font-semibold text-text-muted">{label}</dt>
              <dd className="mt-0.5 font-display text-xl font-extrabold text-ink">
                {stats.statusCounts[status] ?? 0}
              </dd>
            </div>
          ))}
        </dl>
      </Panel>
    </div>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-card border border-line bg-white p-6">
      {children}
    </section>
  );
}

function Stat({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}) {
  return (
    <div className="rounded-card border border-line bg-white p-5">
      <div className="flex items-center gap-2 text-text-muted">
        <Icon size={15} />
        <span className="text-xs font-bold uppercase tracking-[0.14em]">
          {label}
        </span>
      </div>
      <p className="mt-3 font-display text-2xl font-extrabold tracking-tight text-ink">
        {value}
      </p>
      <p className="mt-1 text-xs text-text-muted">{hint}</p>
    </div>
  );
}

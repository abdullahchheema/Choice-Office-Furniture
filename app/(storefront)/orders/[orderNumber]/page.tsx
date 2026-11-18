import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ClearCartOnMount } from "@/components/cart/ClearCartOnMount";
import { WhatsappHandoff } from "@/components/cart/WhatsappHandoff";
import { formatMoney } from "@/lib/money";
import { placedByThisBrowser } from "@/lib/order-access";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/queries";
import { whatsappUrl } from "@/lib/whatsapp";

export const metadata: Metadata = {
  title: "Your order",
  robots: { index: false, follow: false },
};

const STATUS_LABEL: Record<string, string> = {
  PENDING_CONFIRMATION: "Awaiting confirmation",
  CONFIRMED: "Confirmed",
  PROCESSING: "Being prepared",
  READY_FOR_DISPATCH: "Ready for dispatch",
  SHIPPED: "On its way",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

export default async function OrderPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  const { orderNumber } = await params;

  const [order, settings, owned] = await Promise.all([
    prisma.order.findUnique({
      where: { orderNumber },
      include: { items: { orderBy: { createdAt: "asc" } } },
    }),
    getSettings(),
    placedByThisBrowser(orderNumber),
  ]);

  if (!order) notFound();

  const status = STATUS_LABEL[order.status] ?? order.status;

  /* Someone who merely guessed a reference gets the reference back and nothing
     else — no name, phone, address or item list. See lib/order-access.ts. */
  if (!owned) {
    return (
      <section className="section">
        <div className="shell shell--narrow">
          <div className="order-ref">
            <p className="eyebrow">Order reference</p>
            <strong>{order.orderNumber}</strong>
            <p className="sub">
              This order is {status.toLowerCase()}. For details, message us on
              WhatsApp at {settings.whatsappDisplay} with the reference above.
            </p>
          </div>
          <p style={{ textAlign: "center", marginTop: 28 }}>
            <Link className="btn btn--ghost" href="/shop">
              Back to the shop
            </Link>
          </p>
        </div>
      </section>
    );
  }

  const waUrl = order.whatsappMessage
    ? whatsappUrl(settings.whatsappE164, order.whatsappMessage)
    : null;

  const isNew = order.status === "PENDING_CONFIRMATION";

  return (
    <section className="section">
      <div className="shell shell--narrow">
        {/* The order is safely in the database by the time this renders, so the
            cart can be emptied. Doing it before the write would lose the cart
            on any failure. */}
        {isNew ? <ClearCartOnMount /> : null}

        {/*
          The reference comes first, before the WhatsApp button, and that order
          is deliberate. A real share of customers never reach WhatsApp — no
          app installed, popup blocked, tab closed — and if the reference were
          only visible after the handoff they would be left with no record of
          an order that does exist.
        */}
        <div className="order-ref" data-reveal>
          <p className="eyebrow">
            {isNew ? "Order received" : "Order reference"}
          </p>
          <strong>{order.orderNumber}</strong>
          <p className="sub">
            {isNew
              ? "Your order is saved. Send it to us on WhatsApp and we'll confirm stock, delivery and total."
              : `This order is ${status.toLowerCase()}.`}
          </p>
          {!isNew ? (
            <p style={{ marginTop: 16 }}>
              <span className="status-pill">{status}</span>
            </p>
          ) : null}
        </div>

        {waUrl ? (
          <WhatsappHandoff
            orderNumber={order.orderNumber}
            url={waUrl}
            message={order.whatsappMessage ?? ""}
            display={settings.whatsappDisplay}
            fresh={isNew}
          />
        ) : null}

        <div className="panel" style={{ marginTop: 24 }}>
          <h2>What you ordered</h2>
          <ul className="line-list" style={{ marginTop: 16 }}>
            {order.items.map((item) => (
              <li
                key={item.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 16,
                  padding: "11px 0",
                  borderBottom: "1px solid var(--line)",
                }}
              >
                <span>
                  <strong style={{ fontWeight: 700 }}>{item.productName}</strong>
                  <br />
                  <span className="line-meta">
                    {item.quantity} ×{" "}
                    {formatMoney(item.unitPrice, settings.currencySymbol)} ·{" "}
                    {item.productSku}
                  </span>
                </span>
                <strong style={{ whiteSpace: "nowrap" }}>
                  {formatMoney(item.lineTotal, settings.currencySymbol)}
                </strong>
              </li>
            ))}
          </ul>

          <ul className="totals" style={{ marginTop: 20 }}>
            <li>
              <span>Subtotal</span>
              <strong>{formatMoney(order.subtotal, settings.currencySymbol)}</strong>
            </li>
            <li>
              <span>Delivery</span>
              <strong>
                {Number(order.shippingFee) === 0
                  ? "Free"
                  : formatMoney(order.shippingFee, settings.currencySymbol)}
              </strong>
            </li>
            <li className="grand">
              <span>Total</span>
              <strong>{formatMoney(order.total, settings.currencySymbol)}</strong>
            </li>
          </ul>
          <p className="hint" style={{ marginTop: 14 }}>
            Final total is confirmed with you on WhatsApp before anything is
            dispatched.
          </p>
        </div>

        <div className="panel">
          <h2>Delivering to</h2>
          <p className="hint" style={{ marginTop: 10, lineHeight: 1.7 }}>
            {order.customerName}
            <br />
            {order.customerPhone}
            <br />
            {order.shippingAddress}
            <br />
            {[order.shippingCity, order.shippingProvince, order.shippingPostalCode]
              .filter(Boolean)
              .join(", ")}
          </p>
          {order.customerNote ? (
            <p className="hint" style={{ marginTop: 14 }}>
              <strong>Your note:</strong> {order.customerNote}
            </p>
          ) : null}
        </div>

        <p style={{ textAlign: "center", marginTop: 28 }}>
          <Link className="btn btn--ghost" href="/shop">
            Continue shopping
          </Link>
        </p>
      </div>
    </section>
  );
}

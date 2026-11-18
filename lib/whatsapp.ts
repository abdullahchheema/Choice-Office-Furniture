import { formatMoney } from "@/lib/money";
import { whatsappDialNumber } from "@/lib/phone";

/**
 * The WhatsApp handoff message.
 *
 * Rendered server-side and stored on the order, so what the shop received and
 * what the customer sent are provably the same text — and so the message can be
 * shown again on the confirmation page if WhatsApp never opened.
 *
 * `wa.me` carries the message in the query string, and long URLs are where this
 * degrades: browsers tolerate far more, but WhatsApp's own handlers start
 * truncating somewhere past ~2000 characters and the failure is silent — the
 * chat opens with half a message. So the itemised list is capped and the
 * remainder collapsed into one line. The order reference is the first thing in
 * the message for the same reason: if anything after it is lost, staff can
 * still look the order up.
 */

const MAX_ITEM_LINES = 15;
/** Conservative: well under where wa.me starts truncating. */
const MAX_MESSAGE_CHARS = 1600;

export type WhatsappOrderLine = {
  productName: string;
  productSku: string;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
};

export type WhatsappOrderSummary = {
  orderNumber: string;
  brandName: string;
  customerName: string;
  customerPhone: string;
  shippingAddress: string;
  shippingCity: string;
  customerNote?: string | null;
  currencySymbol: string;
  lines: WhatsappOrderLine[];
  subtotal: string;
  shippingFee: string;
  total: string;
  itemCount: number;
  siteUrl?: string;
};

export function renderOrderMessage(order: WhatsappOrderSummary): string {
  const money = (value: string) => formatMoney(value, order.currencySymbol);

  const shown = order.lines.slice(0, MAX_ITEM_LINES);
  const hidden = order.lines.length - shown.length;

  const itemLines = shown.map(
    (line, index) =>
      `${index + 1}. ${line.productName} (${line.productSku})\n` +
      `   ${line.quantity} × ${money(line.unitPrice)} = ${money(line.lineTotal)}`,
  );

  if (hidden > 0) {
    itemLines.push(
      `…and ${hidden} more item${hidden === 1 ? "" : "s"} — the full list is on order ${order.orderNumber}.`,
    );
  }

  const parts = [
    `*New order ${order.orderNumber}*`,
    `${order.brandName}`,
    "",
    `*Items (${order.itemCount})*`,
    itemLines.join("\n"),
    "",
    `Subtotal: ${money(order.subtotal)}`,
    Number(order.shippingFee) > 0 ? `Delivery: ${money(order.shippingFee)}` : null,
    `*Total: ${money(order.total)}*`,
    "",
    "*Deliver to*",
    order.customerName,
    order.customerPhone,
    order.shippingAddress,
    order.shippingCity,
    order.customerNote ? `\n*Note*\n${order.customerNote}` : null,
    order.siteUrl ? `\n${order.siteUrl}/orders/${order.orderNumber}` : null,
  ];

  const message = parts.filter((part) => part !== null).join("\n");

  if (message.length <= MAX_MESSAGE_CHARS) return message;

  // Last resort. Losing the itemisation is survivable because the reference
  // resolves to the full order; losing the reference is not.
  return (
    `*New order ${order.orderNumber}*\n${order.brandName}\n\n` +
    `${order.itemCount} item${order.itemCount === 1 ? "" : "s"} — *Total: ${money(order.total)}*\n\n` +
    `*Deliver to*\n${order.customerName}\n${order.customerPhone}\n` +
    `${order.shippingAddress}\n${order.shippingCity}\n\n` +
    `Please open order ${order.orderNumber} for the full item list.`
  );
}

/**
 * The click-to-chat link.
 *
 * `wa.me` rather than `api.whatsapp.com`: it is the documented short form and
 * resolves to the installed app on mobile and WhatsApp Web on desktop without
 * an interstitial.
 */
export function whatsappUrl(e164: string, message: string): string {
  return `https://wa.me/${whatsappDialNumber(e164)}?text=${encodeURIComponent(message)}`;
}

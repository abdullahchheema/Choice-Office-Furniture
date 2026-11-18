"use client";

import Link from "next/link";

import { useCart } from "@/components/providers/CartProvider";

/**
 * The cart review step.
 *
 * Every figure here is presentational. The server re-reads each price from the
 * database at checkout and recomputes the total on Decimal, so a tampered
 * number in this component changes what one browser displays and nothing else.
 */
export function CartTable({
  shippingFee,
  freeShippingThreshold,
  shippingNote,
}: {
  shippingFee: string;
  freeShippingThreshold: string | null;
  shippingNote: string | null;
}) {
  const { items, subtotalValue, currencySymbol, hydrated, setQty, remove, count } =
    useCart();

  /*
   * Before hydration localStorage has not been read, so an empty cart and a
   * full one are indistinguishable. Showing "your cart is empty" here and then
   * replacing it a frame later is worse than showing nothing, so the skeleton
   * holds the space instead.
   */
  if (!hydrated) {
    return <div className="panel" style={{ minHeight: 240 }} aria-busy="true" />;
  }

  if (items.length === 0) {
    return (
      <div className="empty-state">
        <h2>Your cart is empty</h2>
        <p>
          Chairs, desks, storage and conference tables — all in stock and ready to
          deliver across Pakistan.
        </p>
        <Link className="btn btn--primary" href="/shop">
          Browse the catalogue
        </Link>
      </div>
    );
  }

  const threshold = freeShippingThreshold ? Number(freeShippingThreshold) : null;
  const qualifies = threshold !== null && subtotalValue >= threshold;
  const shipping = qualifies ? 0 : Number(shippingFee);
  const total = subtotalValue + shipping;

  const money = (value: number) =>
    `${currencySymbol} ${new Intl.NumberFormat("en-US").format(Math.round(value))}`;

  return (
    <div className="commerce-layout">
      <div className="panel">
        <ul className="line-list">
          {items.map(({ product, qty }) => (
            <li className="line-item" key={product.id}>
              <div className="line-media">
                {product.image ? (
                  // eslint-disable-next-line @next/next/no-img-element -- see Hero.tsx
                  <img
                    src={product.image.src}
                    alt=""
                    style={{ objectPosition: product.image.objectPosition ?? "50% 50%" }}
                  />
                ) : null}
              </div>

              <div>
                <p className="line-title">
                  <Link href={`/products/${product.slug}`}>{product.name}</Link>
                </p>
                <p className="line-meta">{product.priceLabel} each</p>

                <div className="stepper" style={{ marginTop: 10 }} role="group">
                  <button
                    type="button"
                    aria-label={`Decrease quantity of ${product.name}`}
                    disabled={qty <= 1}
                    onClick={() => setQty(product.id, qty - 1)}
                  >
                    −
                  </button>
                  <span aria-live="polite">{qty}</span>
                  <button
                    type="button"
                    aria-label={`Increase quantity of ${product.name}`}
                    disabled={qty >= 99}
                    onClick={() => setQty(product.id, qty + 1)}
                  >
                    +
                  </button>
                </div>
              </div>

              <div>
                <p className="line-amount">
                  {money(Number(product.priceValue) * qty)}
                </p>
                <button
                  type="button"
                  className="line-remove"
                  onClick={() => remove(product.id)}
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <aside className="panel summary">
        <h2>Summary</h2>
        <ul className="totals" style={{ marginTop: 18 }}>
          <li>
            <span>
              Subtotal · {count} item{count === 1 ? "" : "s"}
            </span>
            <strong>{money(subtotalValue)}</strong>
          </li>
          <li>
            <span>Delivery</span>
            <strong>{shipping === 0 ? "Free" : money(shipping)}</strong>
          </li>
          <li className="grand">
            <span>Total</span>
            <strong>{money(total)}</strong>
          </li>
        </ul>

        {threshold !== null && !qualifies ? (
          <p className="free-ship-note">
            Add {money(threshold - subtotalValue)} more for free delivery.
          </p>
        ) : null}
        {shippingNote ? <p className="free-ship-note">{shippingNote}</p> : null}

        <Link
          className="btn btn--primary btn--block"
          href="/checkout"
          style={{ marginTop: 22 }}
        >
          Continue to checkout
        </Link>

        <p className="hint" style={{ marginTop: 14, textAlign: "center" }}>
          No online payment. We confirm your order on WhatsApp.
        </p>
      </aside>
    </div>
  );
}

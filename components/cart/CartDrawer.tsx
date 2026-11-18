"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { Icon } from "@/components/layout/SvgSprite";
import { useCart } from "@/components/providers/CartProvider";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function CartDrawer() {
  const { items, subtotalLabel, currencySymbol, isOpen, close, setQty, remove } =
    useCart();

  const drawerRef = useRef<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const lastFocused = useRef<HTMLElement | null>(null);

  // The overlay keeps the original's two-step timing: unhide, then fade in on
  // the next frame; fade out, then re-hide once the 420ms transition ends.
  const [overlayHidden, setOverlayHidden] = useState(true);
  const [overlayVisible, setOverlayVisible] = useState(false);

  /*
   * The cascading render here is the point, not an oversight: the element has
   * to be in the layout for a frame *before* `.show` is added, or the opacity
   * transition has nothing to animate from and the overlay snaps in. Closing
   * is the mirror — fade first, re-hide only once the 420ms transition ends,
   * so the overlay is not yanked out from under its own animation.
   */
  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- see above
      setOverlayHidden(false);
      const frame = requestAnimationFrame(() => setOverlayVisible(true));
      return () => cancelAnimationFrame(frame);
    }
    setOverlayVisible(false);
    const timer = setTimeout(() => setOverlayHidden(true), 420);
    return () => clearTimeout(timer);
  }, [isOpen]);

  // Scroll lock + focus move on open, focus restore on close.
  useEffect(() => {
    if (!isOpen) return;
    lastFocused.current = document.activeElement as HTMLElement | null;
    document.body.classList.add("no-scroll");
    const timer = setTimeout(() => closeButtonRef.current?.focus(), 60);

    return () => {
      clearTimeout(timer);
      document.body.classList.remove("no-scroll");
      lastFocused.current?.focus();
    };
  }, [isOpen]);

  // Escape to close, Tab wrapped inside the dialog.
  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== "Tab") return;

      const drawer = drawerRef.current;
      if (!drawer) return;

      const focusable = Array.from(
        drawer.querySelectorAll<HTMLElement>(FOCUSABLE),
      ).filter((el) => el.offsetParent !== null || el === document.activeElement);

      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, close]);

  const isEmpty = items.length === 0;

  return (
    <>
      <div
        className={`overlay${overlayVisible ? " show" : ""}`}
        hidden={overlayHidden}
        onClick={close}
      />

      <aside
        ref={drawerRef}
        className={`drawer${isOpen ? " open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cartTitle"
        aria-hidden={!isOpen}
        tabIndex={-1}
      >
        <header className="drawer-head">
          <h2 id="cartTitle">Your cart</h2>
          <button
            type="button"
            ref={closeButtonRef}
            className="icon-btn"
            aria-label="Close cart"
            onClick={close}
          >
            <Icon name="i-close" />
          </button>
        </header>

        <div className="drawer-body">
          <p className="cart-empty" hidden={!isEmpty}>
            Your cart is empty.
            <br />
            <Link href="/shop" onClick={close}>
              Browse the catalogue →
            </Link>
          </p>

          <ul className="cart-list">
            {items.map(({ product, qty }) => (
              /*
               * Keyed by product id, so the quantity's live region is updated
               * in place rather than replaced. The original rebuilt the whole
               * list with innerHTML on every change, which swapped the live
               * region out and meant screen readers often missed the update.
               */
              <li className="cart-item" key={product.id}>
                <div className="cart-thumb">
                  {product.image ? (
                    // eslint-disable-next-line @next/next/no-img-element -- see Hero.tsx: plain img for the fidelity phase
                    <img
                      src={product.image.src}
                      alt=""
                      width={84}
                      height={84}
                      style={{
                        objectPosition: product.image.objectPosition ?? "50% 50%",
                      }}
                    />
                  ) : null}
                </div>

                <div>
                  <h3>{product.name}</h3>
                  <p className="unit">{product.priceLabel}</p>
                  <div className="qty" role="group">
                    <button
                      type="button"
                      aria-label={`Decrease quantity of ${product.name}`}
                      onClick={() => setQty(product.id, qty - 1)}
                    >
                      −
                    </button>
                    <span aria-live="polite">{qty}</span>
                    <button
                      type="button"
                      aria-label={`Increase quantity of ${product.name}`}
                      onClick={() => setQty(product.id, qty + 1)}
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="cart-line">
                  <span>{lineTotal(product.priceValue, qty, currencySymbol)}</span>
                  <button
                    type="button"
                    className="remove"
                    aria-label={`Remove ${product.name}`}
                    onClick={() => remove(product.id)}
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <footer className="drawer-foot" hidden={isEmpty}>
          <div className="subtotal">
            <span>Subtotal</span>
            <strong>{subtotalLabel}</strong>
          </div>
          <p className="note">Delivery calculated at checkout.</p>
          <Link href="/cart" className="btn btn--primary btn--block" onClick={close}>
            Review &amp; checkout
          </Link>
        </footer>
      </aside>
    </>
  );
}

/** Line total, formatted the same way the server formats every other amount. */
function lineTotal(priceValue: string, qty: number, symbol: string): string {
  const total = Number(priceValue) * qty;
  return `${symbol} ${new Intl.NumberFormat("en-US").format(Math.round(total))}`;
}

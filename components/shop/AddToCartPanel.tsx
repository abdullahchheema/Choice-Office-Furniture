"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Icon } from "@/components/layout/SvgSprite";
import { useCart } from "@/components/providers/CartProvider";
import { useWishlist } from "@/components/providers/WishlistProvider";

/**
 * Quantity, add to cart, wishlist.
 *
 * The quantity cap is the smaller of 99 (the schema's per-line maximum) and
 * what is actually in stock, so the ordinary case never reaches the server's
 * availability check. The check still runs there — this is a convenience, not
 * the enforcement.
 */
export function AddToCartPanel({
  productId,
  productName,
  productSlug,
  inStock,
  maxQty,
}: {
  productId: string;
  productName: string;
  productSlug: string;
  inStock: boolean;
  maxQty: number;
}) {
  const { add, setQty, open } = useCart();
  const { has, toggle, hydrated } = useWishlist();
  const router = useRouter();
  const [qty, setLocalQty] = useState(1);

  const saved = hydrated && has(productId);
  const cap = Math.max(1, Math.min(99, maxQty));

  /* The cart's `add` increments by one, which is the right primitive for a
     card. Here the customer has chosen a quantity, so add once to create the
     line and then set it outright — the alternative is calling add() n times
     and firing n toasts. */
  function addChosenQuantity() {
    add(productId);
    if (qty > 1) setQty(productId, qty);
  }

  return (
    <div>
      <div className="pdp-actions">
        <div className="stepper" role="group" aria-label="Quantity">
          <button
            type="button"
            aria-label="Decrease quantity"
            disabled={qty <= 1 || !inStock}
            onClick={() => setLocalQty((n) => Math.max(1, n - 1))}
          >
            −
          </button>
          <span aria-live="polite">{qty}</span>
          <button
            type="button"
            aria-label="Increase quantity"
            disabled={qty >= cap || !inStock}
            onClick={() => setLocalQty((n) => Math.min(cap, n + 1))}
          >
            +
          </button>
        </div>

        <button
          type="button"
          className="btn btn--primary"
          disabled={!inStock}
          onClick={() => {
            addChosenQuantity();
            open();
          }}
        >
          {inStock ? "Add to cart" : "Out of stock"}
        </button>

        <button
          type="button"
          className="btn btn--ghost"
          disabled={!inStock}
          onClick={() => {
            addChosenQuantity();
            router.push("/checkout");
          }}
        >
          Order now
        </button>
      </div>

      <button
        type="button"
        className="line-remove"
        style={{ marginLeft: 0 }}
        aria-pressed={saved}
        onClick={() => toggle(productId, productName)}
      >
        <Icon name="i-heart" />{" "}
        {saved ? "Saved to your wishlist" : "Save for later"}
      </button>

      <p className="hint" style={{ marginTop: 18 }}>
        Reference <strong>{productSlug}</strong> when you message us.
      </p>
    </div>
  );
}

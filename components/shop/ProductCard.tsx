"use client";

import Link from "next/link";
import { useState } from "react";

import { Icon } from "@/components/layout/SvgSprite";
import { useCart } from "@/components/providers/CartProvider";
import { useWishlist } from "@/components/providers/WishlistProvider";
import type { ProductDTO } from "@/lib/dto";
import { revealDelay } from "@/lib/utils";

/**
 * The catalogue card.
 *
 * One implementation, used by the homepage's featured strip, the shop listing
 * and the "you might also like" row — the original had this markup in one
 * place and it should stay that way.
 *
 * The title is the link rather than the whole card: the media already carries
 * a wishlist button and an add-to-cart button, and a button nested inside an
 * anchor is invalid HTML whose keyboard and screen-reader behaviour differs
 * between browsers.
 */

const REVEAL_DELAYS = [0, 80, 160, 0, 80, 160, 0, 80];

export function ProductCard({
  product,
  hidden = false,
  fadingOut = false,
  revealIndex = 0,
}: {
  product: ProductDTO;
  hidden?: boolean;
  fadingOut?: boolean;
  revealIndex?: number;
}) {
  const { add } = useCart();
  const { has, toggle, hydrated } = useWishlist();
  const [justAdded, setJustAdded] = useState(false);

  const saved = hydrated && has(product.id);
  const delay = REVEAL_DELAYS[revealIndex % REVEAL_DELAYS.length] ?? 0;
  /*
   * Badges: the admin's manual one wins; otherwise the computed ones. The sale
   * badge is derived from the compare-at price, so it appears and disappears
   * with the price instead of being typed in by hand.
   */
  const sale = product.discountPercent ? `-${product.discountPercent}%` : null;
  const badge = product.badge ?? sale ?? (product.isLowStock ? "Low stock" : null);
  const quickAddId = product.type === "SIMPLE" ? product.defaultVariantId : null;

  return (
    <li
      className={`card${fadingOut ? " is-out" : ""}`}
      hidden={hidden}
      data-reveal
      style={delay ? revealDelay(delay) : undefined}
    >
      <figure
        className="card-media"
        style={{ "--tone": product.toneHex ?? "#E8D9C3" } as React.CSSProperties}
      >
        {product.image ? (
          // eslint-disable-next-line @next/next/no-img-element -- see Hero.tsx
          <img
            src={product.image.src}
            width={product.image.width ?? undefined}
            height={product.image.height ?? undefined}
            loading="lazy"
            decoding="async"
            alt={product.image.alt}
            style={{ objectPosition: product.image.objectPosition ?? "50% 50%" }}
          />
        ) : null}

        {badge ? (
          <span className={`badge${badge === sale ? " badge--sale" : ""}`}>{badge}</span>
        ) : null}

        <button
          type="button"
          className="wish"
          aria-pressed={saved}
          aria-label={`Save ${product.name} to wishlist`}
          onClick={() => toggle(product.id, product.name)}
        >
          <Icon name="i-heart" />
        </button>

        {quickAddId ? (
          <button
            type="button"
            className={`add${justAdded ? " added" : ""}`}
            disabled={!product.inStock}
            onClick={() => {
              add(quickAddId);
              setJustAdded(true);
              setTimeout(() => setJustAdded(false), 1400);
            }}
          >
            {!product.inStock ? "Out of stock" : justAdded ? "Added ✓" : "Add to cart"}
          </button>
        ) : (
          // A variable product has no single thing to add — the customer has to
          // choose colour, size and so on, so the button goes to the page where
          // they can.
          <Link className="add is-link" href={`/products/${product.slug}`}>
            {product.inStock ? "Select options" : "View — sold out"}
          </Link>
        )}
      </figure>

      <div className="card-body">
        <div>
          <p className="card-cat">{product.categoryName}</p>
          <h3>
            <Link href={`/products/${product.slug}`}>{product.name}</Link>
          </h3>
        </div>
        <p className="price">
          {product.priceIsFrom ? <span className="from">From</span> : null}
          {product.priceLabel}
          {product.compareAtLabel ? <span className="was">{product.compareAtLabel}</span> : null}
        </p>
      </div>
    </li>
  );
}

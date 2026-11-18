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
  const badge = product.badge ?? (product.isLowStock ? "Low stock" : null);

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

        {badge ? <span className="badge">{badge}</span> : null}

        <button
          type="button"
          className="wish"
          aria-pressed={saved}
          aria-label={`Save ${product.name} to wishlist`}
          onClick={() => toggle(product.id, product.name)}
        >
          <Icon name="i-heart" />
        </button>

        <button
          type="button"
          className={`add${justAdded ? " added" : ""}`}
          disabled={!product.inStock}
          onClick={() => {
            add(product.id);
            setJustAdded(true);
            setTimeout(() => setJustAdded(false), 1400);
          }}
        >
          {!product.inStock ? "Out of stock" : justAdded ? "Added ✓" : "Add to cart"}
        </button>
      </figure>

      <div className="card-body">
        <div>
          <p className="card-cat">{product.categoryName}</p>
          <h3>
            <Link href={`/products/${product.slug}`}>{product.name}</Link>
          </h3>
        </div>
        <p className="price">{product.priceLabel}</p>
      </div>
    </li>
  );
}

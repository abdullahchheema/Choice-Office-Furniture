"use client";

import { useEffect, useRef, useState } from "react";

import { Icon } from "@/components/layout/SvgSprite";
import { useCart } from "@/components/providers/CartProvider";
import { useShopFilter, type FilterValue } from "@/components/providers/ShopFilterProvider";
import { useWishlist } from "@/components/providers/WishlistProvider";
import type { ProductDTO } from "@/lib/dto";
import { useReducedMotion } from "@/lib/hooks";
import { revealDelay } from "@/lib/utils";

const FADE_MS = 280;

export type ShopFilter = { value: FilterValue; label: string };

export function ShopSection({
  products,
  filters,
  eyebrow = "Featured",
  heading = "Pieces we stand behind",
}: {
  products: ProductDTO[];
  filters: ShopFilter[];
  eyebrow?: string;
  heading?: string;
}) {
  const { filter, setFilter } = useShopFilter();
  const reduce = useReducedMotion();
  const gridRef = useRef<HTMLUListElement | null>(null);
  const isFirstRun = useRef(true);

  const [staged, setApplied] = useState<FilterValue>(filter);
  const [fadingOut, setFadingOut] = useState(false);

  // With motion reduced there is no cross-fade to stage, so the selection
  // applies immediately and the timing state is bypassed entirely.
  const applied = reduce ? filter : staged;

  /*
   * Deliberately a cascading render: the grid has to paint once with the old
   * contents faded out before the new selection swaps in, which is what
   * produces the 280ms cross-fade.
   */
  useEffect(() => {
    if (reduce || filter === applied) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- see above
    setFadingOut(true);
    const timer = setTimeout(() => {
      setApplied(filter);
      setFadingOut(false);
    }, FADE_MS);
    return () => clearTimeout(timer);
  }, [filter, applied, reduce]);

  /*
   * Stagger the cards back in with the Web Animations API, matching the
   * original's 560ms / 70ms-step entrance. It cannot be done with the `--d`
   * custom property here: storefront.css overrides `.card[data-reveal].in`
   * with `transition-delay: 0s` so the reveal transition does not fight this
   * filter timing. Unlike imperative `hidden` writes, a Web Animation is not
   * an inline style, so a re-render cannot clobber it.
   */
  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    if (reduce || fadingOut) return;

    const grid = gridRef.current;
    if (!grid) return;

    Array.from(grid.querySelectorAll<HTMLElement>("li.card:not([hidden])")).forEach(
      (card, index) => {
        card.animate(
          [
            { opacity: 0, transform: "translateY(22px)" },
            { opacity: 1, transform: "none" },
          ],
          {
            duration: 560,
            delay: index * 70,
            easing: "cubic-bezier(.16,1,.3,1)",
            fill: "backwards",
          },
        );
      },
    );
  }, [applied, fadingOut, reduce]);

  return (
    <section className="section section--tint" id="shop">
      <div className="shell">
        <header className="section-head section-head--row" data-reveal>
          <div>
            <p className="eyebrow">{eyebrow}</p>
            <h2>{heading}</h2>
          </div>

          <div className="filters" role="group" aria-label="Filter products by category">
            {filters.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`chip${filter === option.value ? " is-active" : ""}`}
                aria-pressed={filter === option.value}
                onClick={() => setFilter(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </header>

        <ul className="product-grid" ref={gridRef}>
          {products.map((product, index) => (
            <ProductCard
              key={product.id}
              product={product}
              hidden={applied !== "all" && product.categorySlug !== applied}
              fadingOut={fadingOut}
              revealIndex={index}
            />
          ))}
        </ul>
      </div>
    </section>
  );
}

const REVEAL_DELAYS = [0, 80, 160, 0, 80, 160, 0, 80];

function ProductCard({
  product,
  hidden,
  fadingOut,
  revealIndex,
}: {
  product: ProductDTO;
  hidden: boolean;
  fadingOut: boolean;
  revealIndex: number;
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
          <h3>{product.name}</h3>
        </div>
        <p className="price">{product.priceLabel}</p>
      </div>
    </li>
  );
}

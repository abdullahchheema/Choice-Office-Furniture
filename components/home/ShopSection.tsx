"use client";

import { useEffect, useRef, useState } from "react";

import { Icon } from "@/components/layout/SvgSprite";
import { useCart } from "@/components/providers/CartProvider";
import { useWishlist } from "@/components/providers/WishlistProvider";
import { useShopFilter, type FilterValue } from "@/components/providers/ShopFilterProvider";
import { FILTERS, PRODUCTS, formatPrice, type Product } from "@/lib/catalog";
import { useReducedMotion } from "@/lib/hooks";
import { revealDelay } from "@/lib/utils";

const FADE_MS = 280;

export function ShopSection() {
  const { filter, setFilter } = useShopFilter();
  const reduce = useReducedMotion();
  const gridRef = useRef<HTMLUListElement | null>(null);
  const isFirstRun = useRef(true);

  /*
   * `applied` lags `filter` by the fade-out duration. React owns `hidden` and
   * the `is-out` class the whole time — the original mutated both imperatively,
   * which works until an unrelated re-render clobbers them and cards
   * intermittently reappear.
   */
  const [staged, setApplied] = useState<FilterValue>(filter);
  const [fadingOut, setFadingOut] = useState(false);

  // With motion reduced there is no cross-fade to stage, so the selection
  // applies immediately and the timing state is bypassed entirely.
  const applied = reduce ? filter : staged;

  /*
   * Deliberately a cascading render: the grid has to paint once with the old
   * contents faded out before the new selection swaps in, which is what
   * produces the 280ms cross-fade. Under reduced motion `applied` is derived
   * straight from `filter` below, so no timing state is involved at all.
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
   * original's 560ms / 70ms-step / back-eased entrance.
   *
   * It cannot be done with the `--d` custom property here: storefront.css
   * deliberately overrides `.card[data-reveal].in` with `transition-delay: 0s`
   * so the reveal transition does not fight this 280ms filter timing. Unlike
   * imperative `hidden` writes, `element.animate()` is safe under React — a
   * Web Animation is not an inline style, so a re-render cannot clobber it.
   */
  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    if (reduce || fadingOut) return;

    const grid = gridRef.current;
    if (!grid) return;

    const visible = Array.from(
      grid.querySelectorAll<HTMLElement>("li.card:not([hidden])"),
    );
    visible.forEach((card, index) => {
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
    });
  }, [applied, fadingOut, reduce]);

  const matches = (product: Product) =>
    applied === "all" || product.categories.includes(applied);

  return (
    <section className="section section--tint" id="shop">
      <div className="shell">
        <header className="section-head section-head--row" data-reveal>
          <div>
            <p className="eyebrow">Featured</p>
            <h2>
              Pieces we <em>love</em>
            </h2>
          </div>

          <div className="filters" role="group" aria-label="Filter products by room">
            {FILTERS.map((option) => (
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
          {PRODUCTS.map((product, index) => (
            <ProductCard
              key={product.id}
              product={product}
              hidden={!matches(product)}
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
  product: Product;
  hidden: boolean;
  fadingOut: boolean;
  revealIndex: number;
}) {
  const { add } = useCart();
  const { has, toggle, hydrated } = useWishlist();
  const [justAdded, setJustAdded] = useState(false);

  const saved = hydrated && has(product.id);
  const delay = REVEAL_DELAYS[revealIndex] ?? 0;

  return (
    <li
      className={`card${fadingOut ? " is-out" : ""}`}
      hidden={hidden}
      data-reveal
      style={delay ? revealDelay(delay) : undefined}
    >
      <figure
        className="card-media"
        style={{ "--tone": product.tone } as React.CSSProperties}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className={product.image.lift ? "lift" : undefined}
          src={product.image.src}
          width={product.image.width}
          height={product.image.height}
          loading="lazy"
          decoding="async"
          alt={product.image.alt}
          style={{ objectPosition: product.image.objectPosition }}
        />

        {product.badge ? <span className="badge">{product.badge}</span> : null}

        <button
          type="button"
          className="wish"
          aria-pressed={saved}
          aria-label={`Save ${product.name} to wishlist`}
          onClick={() => toggle(product.id)}
        >
          <Icon name="i-heart" />
        </button>

        <button
          type="button"
          className={`add${justAdded ? " added" : ""}`}
          onClick={() => {
            add(product.id);
            setJustAdded(true);
            setTimeout(() => setJustAdded(false), 1400);
          }}
        >
          {justAdded ? "Added ✓" : "Add to cart"}
        </button>
      </figure>

      <div className="card-body">
        <div>
          <p className="card-cat">{product.displayCategory}</p>
          <h3>{product.name}</h3>
        </div>
        <p className="price">{formatPrice(product.price)}</p>
      </div>
    </li>
  );
}

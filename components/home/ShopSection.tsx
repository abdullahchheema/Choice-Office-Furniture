"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { useShopFilter, type FilterValue } from "@/components/providers/ShopFilterProvider";
import { ProductCard } from "@/components/shop/ProductCard";
import type { ProductDTO } from "@/lib/dto";
import { useReducedMotion } from "@/lib/hooks";

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
            <Link className="chip" href="/shop">
              View all →
            </Link>
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

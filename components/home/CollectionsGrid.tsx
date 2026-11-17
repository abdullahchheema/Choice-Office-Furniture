"use client";

import { Icon } from "@/components/layout/SvgSprite";
import { useShopFilter } from "@/components/providers/ShopFilterProvider";
import type { CategoryDTO } from "@/lib/dto";
import { revealDelay } from "@/lib/utils";

/**
 * The bento grid. Tile size and stagger follow position, so the layout holds
 * whichever four categories the admin flags for the homepage.
 */
const MODIFIERS = ["tile--lg", "", "", "tile--wide"];
const DELAYS = [0, 90, 180, 270];

export function CollectionsGrid({
  categories,
  eyebrow = "Collections",
  heading = "Workspaces made calm",
  blurb = "Four considered ranges, each built around honest materials and hardware that outlasts the warranty.",
}: {
  categories: CategoryDTO[];
  eyebrow?: string;
  heading?: string;
  blurb?: string;
}) {
  const { setFilter } = useShopFilter();

  if (categories.length === 0) return null;

  return (
    <section className="section" id="collections">
      <div className="shell">
        <header className="section-head" data-reveal>
          <p className="eyebrow">{eyebrow}</p>
          <h2>{heading}</h2>
          <p className="section-sub">{blurb}</p>
        </header>

        <div className="collections-grid">
          {categories.slice(0, 4).map((category, index) => (
            <a
              key={category.id}
              className={`tile${MODIFIERS[index] ? ` ${MODIFIERS[index]}` : ""}`}
              href="#shop"
              data-reveal
              style={
                {
                  "--tone": category.toneHex ?? "#E6D5BD",
                  ...(DELAYS[index] ? revealDelay(DELAYS[index]) : {}),
                } as React.CSSProperties
              }
              // Follows the anchor to #shop and narrows the grid, exactly as
              // the original's data-filter-link did.
              onClick={() => setFilter(category.slug)}
            >
              {category.imagePath ? (
                // eslint-disable-next-line @next/next/no-img-element -- see Hero.tsx
                <img
                  className="tile-img"
                  src={category.imagePath}
                  loading="lazy"
                  decoding="async"
                  alt={category.description ?? category.name}
                />
              ) : null}
              <div className="tile-meta">
                <h3>{category.name}</h3>
                <span>
                  {category.productCount}{" "}
                  {category.productCount === 1 ? "piece" : "pieces"}
                </span>
              </div>
              <span className="tile-arrow" aria-hidden="true">
                <Icon name="i-arrow" />
              </span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

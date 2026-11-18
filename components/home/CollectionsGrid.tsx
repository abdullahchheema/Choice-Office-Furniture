import Link from "next/link";

import { Icon } from "@/components/layout/SvgSprite";
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
            /*
             * Goes to the filtered catalogue rather than scrolling to the
             * featured strip, as the original did. The strip only holds a
             * dozen products, so a tile for a category that happens not to be
             * among them used to narrow the grid to nothing; /shop always has
             * the whole category. Dropping the click handler also makes this a
             * Server Component again.
             */
            <Link
              key={category.id}
              className={`tile${MODIFIERS[index] ? ` ${MODIFIERS[index]}` : ""}`}
              href={`/shop?category=${category.slug}`}
              data-reveal
              style={
                {
                  "--tone": category.toneHex ?? "#E6D5BD",
                  ...(DELAYS[index] ? revealDelay(DELAYS[index]) : {}),
                } as React.CSSProperties
              }
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
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

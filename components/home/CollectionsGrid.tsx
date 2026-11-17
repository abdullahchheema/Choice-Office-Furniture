"use client";

import { Icon } from "@/components/layout/SvgSprite";
import { useShopFilter, type FilterValue } from "@/components/providers/ShopFilterProvider";
import { revealDelay } from "@/lib/utils";

type Tile = {
  filter: FilterValue;
  title: string;
  count: string;
  tone: string;
  modifier?: string;
  image: { src: string; width: number; height: number; alt: string };
};

const TILES: Tile[] = [
  {
    filter: "living",
    title: "Living",
    count: "24 pieces",
    tone: "#E6D5BD",
    modifier: "tile--lg",
    image: {
      src: "/assets/images/sofa.jpg",
      width: 1200,
      height: 800,
      alt: "Cream sofa, walnut coffee table and brass floor lamp in a living room",
    },
  },
  {
    filter: "dining",
    title: "Dining",
    count: "18 pieces",
    tone: "#EADCC6",
    image: {
      src: "/assets/images/tile-dining.jpg",
      width: 1200,
      height: 1344,
      alt: "Honey-toned solid wood dining chairs around a matching table",
    },
  },
  {
    filter: "bedroom",
    title: "Bedroom",
    count: "15 pieces",
    tone: "#E1CFB4",
    image: {
      src: "/assets/images/tile-bedroom.jpg",
      width: 1200,
      height: 802,
      alt: "Sunlit bedroom with a slim headboard, crisp white bedding and a bedside table",
    },
  },
  {
    filter: "storage",
    title: "Storage & Light",
    count: "21 pieces",
    tone: "#EFE3CF",
    modifier: "tile--wide",
    image: {
      src: "/assets/images/tile-storage.jpg",
      width: 1200,
      height: 1800,
      alt: "Light birch sideboard with open shelving, vases and a floating wall shelf",
    },
  },
];

const DELAYS = [0, 90, 180, 270];

export function CollectionsGrid() {
  const { setFilter } = useShopFilter();

  return (
    <section className="section" id="collections">
      <div className="shell">
        <header className="section-head" data-reveal>
          <p className="eyebrow">Collections</p>
          <h2>
            Rooms made <em>calm</em>
          </h2>
          <p className="section-sub">
            Four considered collections, each built around natural grain and
            honest joinery.
          </p>
        </header>

        <div className="collections-grid">
          {TILES.map((tile, index) => (
            <a
              key={tile.title}
              className={`tile${tile.modifier ? ` ${tile.modifier}` : ""}`}
              href="#shop"
              data-reveal
              style={{
                "--tone": tile.tone,
                ...(DELAYS[index] ? revealDelay(DELAYS[index]) : {}),
              } as React.CSSProperties}
              // Follows the anchor to #shop and narrows the grid, exactly as
              // the original's data-filter-link did.
              onClick={() => setFilter(tile.filter)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="tile-img"
                src={tile.image.src}
                width={tile.image.width}
                height={tile.image.height}
                loading="lazy"
                decoding="async"
                alt={tile.image.alt}
              />
              <div className="tile-meta">
                <h3>{tile.title}</h3>
                <span>{tile.count}</span>
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

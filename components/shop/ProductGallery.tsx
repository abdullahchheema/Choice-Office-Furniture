"use client";

import { useState } from "react";

export type GalleryImage = {
  src: string;
  alt: string;
  width: number | null;
  height: number | null;
  objectPosition: string | null;
};

/**
 * The product gallery.
 *
 * The first image is rendered eagerly — on a product page it is the largest
 * contentful paint, so lazy-loading it would delay the one thing the page
 * exists to show. The rest are lazy.
 */
export function ProductGallery({
  images,
  toneHex,
  lift,
}: {
  images: GalleryImage[];
  toneHex: string | null;
  lift: boolean;
}) {
  const [index, setIndex] = useState(0);
  const active = images[index];

  return (
    <div className="pdp-gallery">
      <figure
        className="pdp-main"
        style={{ "--tone": toneHex ?? "#E8D9C3" } as React.CSSProperties}
      >
        {active ? (
          // eslint-disable-next-line @next/next/no-img-element -- see Hero.tsx
          <img
            key={active.src}
            src={active.src}
            alt={active.alt}
            width={active.width ?? undefined}
            height={active.height ?? undefined}
            fetchPriority="high"
            decoding="async"
            style={{
              objectPosition: active.objectPosition ?? "50% 50%",
              ...(lift
                ? {
                    filter: "brightness(1.35)",
                    transform: "scale(1.45)",
                    transformOrigin: "90% 80%",
                  }
                : {}),
            }}
          />
        ) : null}
      </figure>

      {images.length > 1 ? (
        <ul className="pdp-thumbs">
          {images.map((image, i) => (
            <li key={image.src}>
              <button
                type="button"
                aria-current={i === index}
                aria-label={`Show image ${i + 1} of ${images.length}`}
                onClick={() => setIndex(i)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- see Hero.tsx */}
                <img
                  src={image.src}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  style={{ objectPosition: image.objectPosition ?? "50% 50%" }}
                />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { Icon } from "@/components/layout/SvgSprite";
import { useCart } from "@/components/providers/CartProvider";
import { useWishlist } from "@/components/providers/WishlistProvider";
import type { ProductDetailDTO, ProductImageDTO, VariantDTO } from "@/lib/dto";
import { groupSpecs, mergeSpecs } from "@/lib/variants";

/**
 * The product page's interactive core.
 *
 * Everything shown here is a function of ONE thing: the selected variant. Its
 * price, struck-through price, discount badge, SKU, stock line, quantity cap,
 * photos and specifications all come from that variant's own data (computed on
 * the server in lib/dto.ts), so choosing "Grey / Bonded leather" swaps the
 * whole picture and the browser does no pricing of its own.
 *
 * The selection is state (attributeId → valueId); the variant is derived from
 * it, never stored, so the two cannot disagree.
 */
export function ProductDetail({
  product,
  initialVariantId,
}: {
  product: ProductDetailDTO;
  initialVariantId?: string;
}) {
  const { variants, attributes } = product;
  const router = useRouter();
  const { add, open } = useCart();
  const { has, toggle, hydrated } = useWishlist();

  const start =
    variants.find((v) => v.id === initialVariantId) ??
    variants.find((v) => v.isDefault) ??
    variants[0];

  const [selection, setSelection] = useState<Record<string, string>>(start?.options ?? {});
  const [qty, setQty] = useState(1);
  const [lightbox, setLightbox] = useState(false);
  // Image position is remembered per variant, so switching variants starts at
  // the first photo without an effect to reset it.
  const [view, setView] = useState<{ variantId: string; index: number }>({
    variantId: start?.id ?? "",
    index: 0,
  });

  /* The selected variant: the one whose options match the selection exactly. */
  const variant: VariantDTO | undefined = useMemo(() => {
    if (attributes.length === 0) return variants[0];
    return variants.find((v) => attributes.every((a) => v.options[a.id] === selection[a.id]));
  }, [variants, attributes, selection]);

  // The selection can only ever land on a combination that exists (see
  // `choose`), but guard anyway: never render a page with no variant.
  const active = variant ?? start;

  const photos: ProductImageDTO[] = active?.images.length ? active.images : product.images;
  const usingSharedPhotos = !active?.images.length;
  const index = view.variantId === active?.id ? Math.min(view.index, Math.max(0, photos.length - 1)) : 0;
  const photo = photos[index];

  const specs = useMemo(
    () => groupSpecs(mergeSpecs(product.specs, active?.specs ?? [])),
    [product.specs, active],
  );

  const maxQty = Math.max(1, active?.maxQty ?? 1);
  const quantity = Math.min(qty, maxQty);
  const canBuy = !!active && active.inStock && active.maxQty > 0;

  /* Keep the address bar pointing at the chosen variant, so a copied link opens
     on it. replaceState: choosing an option is not a navigation worth a Back. */
  useEffect(() => {
    if (!active || variants.length < 2) return;
    const url = new URL(window.location.href);
    url.searchParams.set("variant", active.sku);
    window.history.replaceState(null, "", url);
  }, [active, variants.length]);

  /**
   * Choose a value for one attribute.
   *
   * If the exact combination exists it is used. If not (say Grey only comes in
   * Bonded leather and the customer was on Tan/Leather), the closest real
   * variant carrying that value is picked — preferring one that matches the
   * other current choices, then one that is in stock. Every click therefore
   * lands somewhere sensible instead of being refused.
   */
  function choose(attributeId: string, valueId: string) {
    const candidates = variants.filter((v) => v.options[attributeId] === valueId);
    if (candidates.length === 0) return;

    const score = (v: VariantDTO) =>
      attributes.reduce((n, a) => n + (a.id !== attributeId && v.options[a.id] === selection[a.id] ? 1 : 0), 0);

    const best = [...candidates].sort(
      (a, b) => score(b) - score(a) || Number(b.inStock) - Number(a.inStock),
    )[0];
    setSelection(best.options);
  }

  /* What a chip should look like for a value, given everything else selected. */
  function chipState(attributeId: string, valueId: string): "ok" | "soldout" | "unavailable" {
    const match = variants.find((v) =>
      attributes.every((a) =>
        a.id === attributeId ? v.options[a.id] === valueId : v.options[a.id] === selection[a.id],
      ),
    );
    if (!match) return "unavailable";
    return match.inStock ? "ok" : "soldout";
  }

  function go(delta: number) {
    if (photos.length < 2 || !active) return;
    setView({ variantId: active.id, index: (index + delta + photos.length) % photos.length });
  }

  // Lightbox: Esc closes, arrows move, background scroll is locked.
  useEffect(() => {
    if (!lightbox) return;
    document.body.classList.add("no-scroll");
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLightbox(false);
      if (event.key === "ArrowRight") go(1);
      if (event.key === "ArrowLeft") go(-1);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.classList.remove("no-scroll");
      document.removeEventListener("keydown", onKey);
    };
    // `go` closes over the current index and photo list, which is exactly what
    // the listener needs to see on each change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lightbox, index, photos.length, active?.id]);

  // Sticky mobile buy bar: shown once the real buttons scroll out of view.
  const buyRef = useRef<HTMLDivElement | null>(null);
  const [barVisible, setBarVisible] = useState(false);
  useEffect(() => {
    const node = buyRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => setBarVisible(!entry.isIntersecting && entry.boundingClientRect.top < 0),
      { threshold: 0 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  if (!active) {
    return (
      <p className="pdp-note" role="status">
        This product has no variants available right now.
      </p>
    );
  }

  const saved = hydrated && has(product.id);
  const isVariable = attributes.length > 0;

  function addChosen() {
    add(active!.id, quantity);
  }

  const gallery = (
    <div className="pdp-gallery">
      <div
        className="pdp-main"
        style={{ "--tone": product.toneHex ?? "#E8D9C3", position: "relative" } as React.CSSProperties}
        onMouseMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          event.currentTarget.style.setProperty("--zx", `${((event.clientX - rect.left) / rect.width) * 100}%`);
          event.currentTarget.style.setProperty("--zy", `${((event.clientY - rect.top) / rect.height) * 100}%`);
        }}
      >
        <div className="pdp-badges">
          {active.discountPercent ? (
            <span className="pdp-badge pdp-badge--sale">Save {active.discountPercent}%</span>
          ) : null}
          {product.badge ? <span className="pdp-badge">{product.badge}</span> : null}
          {active.inStock && active.isLowStock ? (
            <span className="pdp-badge pdp-badge--low">Low stock</span>
          ) : null}
          {!active.inStock ? <span className="pdp-badge pdp-badge--low">Sold out</span> : null}
        </div>

        {photo ? (
          <button
            type="button"
            className="pdp-hit"
            aria-label={`Enlarge: ${photo.alt}`}
            onClick={() => setLightbox(true)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- see Hero.tsx */}
            <img
              key={photo.src}
              className="is-entering"
              src={photo.src}
              alt={photo.alt}
              width={photo.width ?? undefined}
              height={photo.height ?? undefined}
              fetchPriority="high"
              decoding="async"
              style={{
                objectPosition: photo.objectPosition ?? product.imageObjectPosition ?? "50% 50%",
                // The brighten-and-zoom knob tunes the product's own dark
                // photo; a variant's uploaded photos are tuned individually.
                ...(product.imageLift && usingSharedPhotos
                  ? { filter: "brightness(1.35)", transform: "scale(1.45)", transformOrigin: "90% 80%" }
                  : {}),
              }}
            />
          </button>
        ) : (
          <div className="pdp-empty">No photo yet</div>
        )}

        {photos.length > 1 ? (
          <>
            <button type="button" className="pdp-nav pdp-nav--prev" aria-label="Previous photo" onClick={() => go(-1)}>
              ‹
            </button>
            <button type="button" className="pdp-nav pdp-nav--next" aria-label="Next photo" onClick={() => go(1)}>
              ›
            </button>
            <span className="pdp-count" aria-hidden="true">
              {index + 1} / {photos.length}
            </span>
          </>
        ) : null}
      </div>

      {photos.length > 1 ? (
        <ul className="pdp-thumbs" aria-label="Product photos">
          {photos.map((image, i) => (
            <li key={image.src}>
              <button
                type="button"
                aria-current={i === index}
                aria-label={`Show photo ${i + 1} of ${photos.length}`}
                onClick={() => setView({ variantId: active.id, index: i })}
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

  return (
    <>
      <div className="pdp">
        {gallery}

        <div className="pdp-info">
          <p className="eyebrow">{product.categoryName}</p>
          <h1>{product.name}</h1>

          {/* Everything below this line is the selected variant's own data.
              aria-live makes a screen reader announce the change. */}
          <div aria-live="polite" aria-atomic="true">
            <div className="pdp-price">
              <span className="now">{active.priceLabel}</span>
              {active.compareAtLabel ? <span className="was">{active.compareAtLabel}</span> : null}
              {active.discountPercent ? <span className="off">{active.discountPercent}% off</span> : null}
            </div>

            <p
              className={`stock-line${active.isLowStock ? " is-low" : ""}${active.inStock ? "" : " is-out"}`}
            >
              <span className="dot" aria-hidden="true" />
              {!active.inStock
                ? "Out of stock — message us for lead times"
                : active.isLowStock && active.stock !== null
                  ? `Only ${active.stock} left in stock`
                  : "In stock, ready to deliver"}
            </p>
            <p className="pdp-sku" style={{ marginTop: 8 }}>
              SKU {active.sku}
            </p>
          </div>

          {product.shortDescription ? (
            <p className="pdp-desc" style={{ marginTop: 18 }}>
              {product.shortDescription}
            </p>
          ) : null}

          {isVariable
            ? attributes.map((attribute) => {
                const chosen = attribute.values.find((v) => v.id === selection[attribute.id]);
                const swatches = attribute.display === "SWATCHES";
                return (
                  <div className="opt-group" key={attribute.id}>
                    <p className="opt-label" id={`opt-${attribute.id}`}>
                      {attribute.name}
                      <strong>{chosen?.value}</strong>
                    </p>
                    <div className="opt-row" role="radiogroup" aria-labelledby={`opt-${attribute.id}`}>
                      {attribute.values.map((value) => {
                        const state = chipState(attribute.id, value.id);
                        const checked = selection[attribute.id] === value.id;
                        const cls = `${swatches ? "opt-swatch" : "opt-btn"}${
                          state === "soldout" ? " is-soldout" : state === "unavailable" ? " is-unavailable" : ""
                        }`;
                        return (
                          <button
                            key={value.id}
                            type="button"
                            role="radio"
                            aria-checked={checked}
                            aria-label={`${attribute.name}: ${value.value}${
                              state === "soldout" ? " (sold out)" : state === "unavailable" ? " (other combination)" : ""
                            }`}
                            title={value.value}
                            className={cls}
                            style={
                              swatches
                                ? ({ "--swatch": value.swatchHex ?? "#cccccc" } as React.CSSProperties)
                                : undefined
                            }
                            onClick={() => choose(attribute.id, value.id)}
                          >
                            {swatches ? null : <span>{value.value}</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            : null}

          <div className="pdp-buy" ref={buyRef}>
            <div className="pdp-buy-row">
              <div className="stepper" role="group" aria-label="Quantity">
                <button
                  type="button"
                  aria-label="Decrease quantity"
                  disabled={quantity <= 1 || !canBuy}
                  onClick={() => setQty(Math.max(1, quantity - 1))}
                >
                  −
                </button>
                <span aria-live="polite">{quantity}</span>
                <button
                  type="button"
                  aria-label="Increase quantity"
                  disabled={quantity >= maxQty || !canBuy}
                  onClick={() => setQty(Math.min(maxQty, quantity + 1))}
                >
                  +
                </button>
              </div>

              <button
                type="button"
                className="btn btn--primary"
                disabled={!canBuy}
                onClick={() => {
                  addChosen();
                  open();
                }}
              >
                {canBuy ? "Add to cart" : "Out of stock"}
              </button>
            </div>

            <button
              type="button"
              className="btn pdp-wa"
              disabled={!canBuy}
              onClick={() => {
                addChosen();
                router.push("/checkout");
              }}
            >
              Order via WhatsApp
            </button>

            <button
              type="button"
              className="line-remove"
              style={{ marginLeft: 0, textAlign: "left" }}
              aria-pressed={saved}
              onClick={() => toggle(product.id, product.name)}
            >
              <Icon name="i-heart" /> {saved ? "Saved to your wishlist" : "Save for later"}
            </button>

            <p className="pdp-note">
              You review your details first. We confirm stock, delivery and the
              final total with you on WhatsApp — nothing is charged online.
            </p>
          </div>
        </div>
      </div>

      {/* Specifications follow the variant: the product's own, with the
          selected variant's overriding or adding to them. */}
      {specs.length > 0 ? (
        <div className="panel" style={{ marginTop: "clamp(40px, 6vw, 72px)" }}>
          <h2>Specifications</h2>
          <div className="spec-groups">
            {specs.map(({ group, rows }) => (
              <section key={group ?? "general"}>
                {group ? <h3>{group}</h3> : null}
                <dl className="spec-list">
                  {rows.map((row) => (
                    <div key={row.name}>
                      <dt>{row.name}</dt>
                      <dd>{row.value}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
          </div>
        </div>
      ) : null}

      {/* Phone-only sticky buy bar. */}
      <div className={`buybar${barVisible ? " is-visible" : ""}`} aria-hidden={!barVisible}>
        <div className="buybar-info">
          <strong>{active.priceLabel}</strong>
          <span>{active.label || product.name}</span>
        </div>
        <button
          type="button"
          className="btn btn--primary"
          tabIndex={barVisible ? 0 : -1}
          disabled={!canBuy}
          onClick={() => {
            addChosen();
            open();
          }}
        >
          {canBuy ? "Add to cart" : "Sold out"}
        </button>
      </div>

      {lightbox && photo ? (
        <div
          className="lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="Photo viewer"
          onClick={() => setLightbox(false)}
        >
          <button type="button" className="lightbox-close" aria-label="Close" onClick={() => setLightbox(false)}>
            ×
          </button>
          {photos.length > 1 ? (
            <>
              <button
                type="button"
                className="pdp-nav pdp-nav--prev"
                aria-label="Previous photo"
                onClick={(event) => {
                  event.stopPropagation();
                  go(-1);
                }}
              >
                ‹
              </button>
              <button
                type="button"
                className="pdp-nav pdp-nav--next"
                aria-label="Next photo"
                onClick={(event) => {
                  event.stopPropagation();
                  go(1);
                }}
              >
                ›
              </button>
            </>
          ) : null}
          {/* eslint-disable-next-line @next/next/no-img-element -- see Hero.tsx */}
          <img src={photo.src} alt={photo.alt} onClick={(event) => event.stopPropagation()} />
          <p className="lightbox-caption">{photo.alt}</p>
        </div>
      ) : null}
    </>
  );
}

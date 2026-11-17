"use client";

import { Icon } from "@/components/layout/SvgSprite";
import { useHeroParallax } from "@/lib/hooks";

/**
 * Full-bleed hero.
 *
 * A client component because the parallax needs refs on three separate nodes
 * (section, background, arch card), which cannot be handed to a server
 * component. The copy is still present in the server-rendered HTML — client
 * components are prerendered — so nothing is lost for SEO.
 *
 * Plain <img> rather than next/image throughout this phase: the whole point of
 * the migration is proving the rendering is unchanged, and next/image injects
 * its own sizing and `color: transparent` styles. It is adopted in Phase 5 for
 * the database-backed product photography, once this baseline is locked in.
 */
export function Hero() {
  const { sectionRef, backgroundRef, archRef } = useHeroParallax();

  return (
    <section className="hero" id="top" ref={sectionRef}>
      <div className="hero-bg" ref={backgroundRef} aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/assets/images/hero-wide.jpg"
          srcSet="/assets/images/hero-wide-md.jpg 1200w, /assets/images/hero-wide.jpg 2400w"
          sizes="100vw"
          width={2400}
          height={1600}
          fetchPriority="high"
          decoding="async"
          alt=""
        />
      </div>

      <div className="hero-shade" aria-hidden="true" />

      <div className="shell hero-inner">
        <div className="hero-copy">
          <p className="eyebrow hero-eyebrow">
            Solid hardwood furniture · Since 1998
          </p>

          {/*
            The visible text is split across masked spans for the line reveal,
            so aria-label restores it as one readable string.
          */}
          <h1 className="hero-title" aria-label="Made from wood. Made for home.">
            <span className="line">
              <span className="line-inner">Made from wood.</span>
            </span>
            <span className="line">
              <span className="line-inner">
                <em>Made for home.</em>
              </span>
            </span>
          </h1>

          <p className="hero-lede">
            Quiet, timeless pieces in solid oak, walnut and ash — shaped by hand,
            finished with natural oils, and designed to be lived in for
            generations.
          </p>

          <div className="hero-cta">
            <a className="btn btn--primary" href="#shop">
              Shop the collection <Icon name="i-arrow" />
            </a>
            <a className="btn btn--ghost" href="#craft">
              Our craft
            </a>
          </div>

          <ul className="hero-points" aria-label="Highlights">
            <li>
              <strong>25-year</strong> guarantee
            </li>
            <li>
              <strong>Free</strong> white-glove delivery
            </li>
            <li>
              <strong>FSC</strong> certified timber
            </li>
          </ul>
        </div>

        <div className="hero-visual">
          <div className="hero-arch">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={archRef}
              className="parallax"
              data-depth="12"
              src="/assets/images/hero.jpg"
              width={1000}
              height={1500}
              fetchPriority="high"
              decoding="async"
              alt="A cream bouclé sofa and a slatted wooden coffee table in warm morning light"
            />
          </div>
          <div className="hero-tag" aria-hidden="true">
            <span className="tag-dot" />
            <span>
              <strong>The Warm Living edit</strong>
              <small>from $1,890</small>
            </span>
          </div>
          <div className="hero-badge" aria-hidden="true">
            <span>
              Hand
              <br />
              finished
            </span>
          </div>
        </div>
      </div>

      <a className="scroll-cue" href="#trust" aria-label="Scroll to content">
        <span />
      </a>
    </section>
  );
}

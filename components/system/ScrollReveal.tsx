"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

import { useReducedMotion } from "@/lib/hooks";

/**
 * Drives the `[data-reveal] -> .in` scroll animation for the whole page.
 *
 * This queries the DOM instead of collecting refs, and that is the decision
 * that keeps the storefront server-rendered: more than thirty elements carry
 * `data-reveal` (trust items, section headings, tiles, cards, craft list,
 * quotes, stats). A ref-based hook would force every one of them to become a
 * client component, which is exactly the SEO boundary worth protecting. As
 * plain attributes they stay in Server Components.
 *
 * Reveals are one-shot — an element is unobserved once shown, matching the
 * original.
 */
export function ScrollReveal() {
  const reduce = useReducedMotion();
  const pathname = usePathname();

  useEffect(() => {
    const nodes = () =>
      Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));

    // No observer support, or the visitor asked for less motion: show
    // everything immediately rather than leaving the page blank.
    if (reduce || !("IntersectionObserver" in window)) {
      nodes().forEach((el) => el.classList.add("in"));
      document.querySelector(".craft-visual")?.classList.add("in");
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("in");
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.14, rootMargin: "0px 0px -6% 0px" },
    );

    const tracked = new WeakSet<Element>();

    const scan = () => {
      for (const el of nodes()) {
        if (el.classList.contains("in") || tracked.has(el)) continue;
        tracked.add(el);

        /*
         * Anything already on screen is revealed synchronously rather than
         * waiting for the observer's first async callback. Without this, a
         * client-side navigation back to this page remounts elements without
         * `.in` and they visibly flash at opacity 0 before appearing.
         */
        const rect = el.getBoundingClientRect();
        if (rect.top < window.innerHeight && rect.bottom > 0) {
          el.classList.add("in");
          continue;
        }

        observer.observe(el);
      }
    };

    scan();

    // Catches cards that are re-shown by the product filter.
    const mutation = new MutationObserver(scan);
    mutation.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      mutation.disconnect();
    };
  }, [reduce, pathname]);

  return null;
}

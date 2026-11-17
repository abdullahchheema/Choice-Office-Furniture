"use client";

import { useEffect } from "react";

/**
 * Adds `is-ready` to <html> once the page has loaded.
 *
 * storefront.css gates the entire hero choreography on `.js` (set statically in
 * the layout, so there is never an unstyled frame) and `.is-ready` — twelve
 * interlocking rules including a clip-path arch reveal and a 22s Ken Burns.
 * Keeping it as one class toggle preserves that animation exactly; porting it
 * to a JS animation library would be pure fidelity risk for no gain.
 *
 * Fires on `load` rather than on mount so the hero image has decoded before the
 * transitions start, with the original 1200ms safety net kept in case `load`
 * never fires (a stalled third-party request, for instance).
 */
export function ReadyFlag() {
  useEffect(() => {
    const markReady = () =>
      requestAnimationFrame(() =>
        document.documentElement.classList.add("is-ready"),
      );

    if (document.readyState === "complete") {
      markReady();
    } else {
      window.addEventListener("load", markReady, { once: true });
    }

    const safetyNet = setTimeout(markReady, 1200);

    return () => {
      window.removeEventListener("load", markReady);
      clearTimeout(safetyNet);
    };
  }, []);

  return null;
}

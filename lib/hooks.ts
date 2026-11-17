"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

/** `useLayoutEffect` that does not warn during SSR. */
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * SSR-safe media query.
 *
 * Returns false on the server, then subscribes. Using useSyncExternalStore
 * rather than a one-off read fixes a real bug in the original script.js, which
 * captured `reduce` once at load — changing the OS motion setting afterwards
 * never took effect until a reload.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    [query],
  );

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/**
 * Returning `false` on the server is correct: the CSS block in storefront.css
 * already neutralises animation for the server-rendered frame, and this only
 * governs the JS-driven motion that CSS cannot stop.
 */
export function useReducedMotion(): boolean {
  return useMediaQuery("(prefers-reduced-motion: reduce)");
}

/** True once the page has scrolled past `threshold`. Drives the header state. */
export function useScrolled(threshold = 24): boolean {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        setScrolled(window.scrollY > threshold);
        ticking = false;
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);

  return scrolled;
}

/**
 * Active section id for the nav underline. The rootMargin is copied verbatim
 * from the original: it creates a band across the middle of the viewport so a
 * section counts as "current" only once it dominates the screen.
 */
export function useScrollSpy(
  ids: readonly string[],
  rootMargin = "-45% 0px -50% 0px",
): string | null {
  const [active, setActive] = useState<string | null>(null);
  const key = ids.join("|");

  useEffect(() => {
    if (!("IntersectionObserver" in window)) return;

    const elements = key
      .split("|")
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);

    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(entry.target.id);
        }
      },
      { rootMargin },
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [key, rootMargin]);

  return active;
}

/**
 * Animated number.
 *
 * The server renders the final figure, so the HTML never contains a
 * meaningless "0" the way the original did. On mount it drops to zero only if
 * the element is still below the fold — if it is already on screen there is
 * nothing to animate into and resetting would cause a visible 25 -> 0 -> 25
 * flash. Duration and easing match the original exactly.
 */
export function useCountUp(target: number, threshold = 0.5) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [display, setDisplay] = useState(() => target.toLocaleString("en-US"));
  const settled = useRef(false);
  const reduce = useReducedMotion();

  useIsomorphicLayoutEffect(() => {
    if (reduce || settled.current) return;
    const el = ref.current;
    if (!el || !("IntersectionObserver" in window)) return;

    const rect = el.getBoundingClientRect();
    const alreadyVisible = rect.top < window.innerHeight && rect.bottom > 0;
    if (alreadyVisible) {
      settled.current = true;
      return;
    }
    setDisplay("0");
  }, [reduce]);

  useEffect(() => {
    if (reduce || settled.current) return;
    const el = ref.current;
    if (!el || !("IntersectionObserver" in window)) {
      setDisplay(target.toLocaleString("en-US"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting || settled.current) return;
        settled.current = true;
        observer.disconnect();

        const started = performance.now();
        const step = (now: number) => {
          const progress = Math.min((now - started) / 1600, 1);
          const eased = 1 - Math.pow(1 - progress, 4);
          setDisplay(Math.round(target * eased).toLocaleString("en-US"));
          if (progress < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      },
      { threshold },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [target, threshold, reduce]);

  return { ref, display };
}

/**
 * Hero motion: the background drifts slower than the page on scroll, and the
 * arch card tilts toward the pointer.
 *
 * Both write `style.transform` straight to the node rather than going through
 * React state — a state update per scroll frame would re-render the hero
 * sixty times a second. These are the only imperative DOM writes in the port,
 * and they are safe because React never re-renders these nodes.
 */
export function useHeroParallax() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const backgroundRef = useRef<HTMLDivElement | null>(null);
  const archRef = useRef<HTMLImageElement | null>(null);
  const reduce = useReducedMotion();
  const finePointer = useMediaQuery("(hover: hover) and (pointer: fine)");

  // Scroll parallax on the background.
  useEffect(() => {
    if (reduce) return;
    const node = backgroundRef.current;
    if (!node) return;

    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        if (window.scrollY < window.innerHeight * 1.2) {
          node.style.transform = `translate3d(0, ${(window.scrollY * 0.28).toFixed(1)}px, 0)`;
        }
        ticking = false;
      });
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      node.style.transform = "";
    };
  }, [reduce]);

  // Pointer parallax on the arch card.
  useEffect(() => {
    if (reduce || !finePointer) return;
    const section = sectionRef.current;
    const arch = archRef.current;
    if (!section || !arch) return;

    const depth = Number(arch.dataset.depth ?? 12);

    const onMove = (event: PointerEvent) => {
      const rect = section.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - 0.5;
      const y = (event.clientY - rect.top) / rect.height - 0.5;
      // scale(1.12) is re-asserted because writing `transform` replaces the
      // value the stylesheet sets on .hero-arch img.
      arch.style.transform = `translate(${(-x * depth).toFixed(1)}px, ${(
        -y *
        depth *
        0.6
      ).toFixed(1)}px) scale(1.12)`;
    };
    const onLeave = () => {
      arch.style.transform = "";
    };

    section.addEventListener("pointermove", onMove);
    section.addEventListener("pointerleave", onLeave);
    return () => {
      section.removeEventListener("pointermove", onMove);
      section.removeEventListener("pointerleave", onLeave);
      arch.style.transform = "";
    };
  }, [reduce, finePointer]);

  return { sectionRef, backgroundRef, archRef };
}

/**
 * Reads a value from localStorage after mount.
 *
 * Returns `hydrated: false` on the first render so consumers can render the
 * same markup the server produced. Without that split the cart badge renders
 * 0 on the server and 3 on the client, which is a hydration mismatch and a
 * visible flash.
 */
export function usePersistentState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const [hydrated, setHydrated] = useState(false);

  /*
   * localStorage cannot be read while rendering on the server, so the stored
   * cart genuinely cannot be the initial state — the first client render has
   * to match the server's empty one, and the real value arrives in a second
   * pass. That second pass is what `hydrated` exists to signal, and consumers
   * render the pre-hydration markup until it flips.
   */
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- see above
      if (raw) setValue(JSON.parse(raw) as T);
    } catch {
      // Private mode, blocked storage, or corrupt JSON — fall back to initial.
    }
    setHydrated(true);
  }, [key]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Storage unavailable; the session simply does not persist.
    }
  }, [key, value, hydrated]);

  // Keep multiple tabs in sync.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== key || event.newValue === null) return;
      try {
        setValue(JSON.parse(event.newValue) as T);
      } catch {
        /* ignore malformed writes from another tab */
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [key]);

  return [value, setValue, hydrated] as const;
}

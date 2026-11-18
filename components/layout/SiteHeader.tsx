"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Icon, Logo } from "@/components/layout/SvgSprite";
import { useCart } from "@/components/providers/CartProvider";
import { useMediaQuery, useScrolled, useScrollSpy } from "@/lib/hooks";

/*
 * Two kinds of nav item now exist, and they behave differently.
 *
 * `route` items are real pages. `section` items are homepage anchors, which
 * only work while you are on the homepage — from /cart or /shop, a bare
 * "#craft" scrolls to nothing at all. So off the homepage they become "/#craft"
 * and navigate home first.
 *
 * Shop became a route when the catalogue page arrived: a nav item called Shop
 * should lead to the whole catalogue, not scroll to the homepage's featured
 * strip. It is therefore no longer in the scroll-spy's section list.
 */
const NAV_LINKS = [
  { kind: "route", href: "/shop", id: "shop", label: "Shop" },
  { kind: "section", id: "collections", label: "Collections" },
  { kind: "section", id: "craft", label: "Craftsmanship" },
  { kind: "section", id: "finishes", label: "Finishes" },
  { kind: "section", id: "visit", label: "Showroom" },
] as const;

const SECTION_IDS = NAV_LINKS.filter((link) => link.kind === "section").map(
  (link) => link.id,
);

export function SiteHeader() {
  const scrolled = useScrolled(24);
  const activeSection = useScrollSpy(SECTION_IDS);
  const isDesktop = useMediaQuery("(min-width: 901px)");
  const { count, hydrated, open } = useCart();
  const pathname = usePathname();
  const onHome = pathname === "/";

  const [menuOpen, setMenuOpen] = useState(false);
  const [bump, setBump] = useState(false);
  const previousCount = useRef(0);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);

  /*
   * The menu only exists as a full-screen overlay below 901px, so whether it
   * is showing is derived rather than stored. An effect that closed it on
   * resize would be a second source of truth and an extra render pass; this
   * way widening the viewport simply stops it applying.
   */
  const menuShowing = menuOpen && !isDesktop;

  useEffect(() => {
    document.body.classList.toggle("no-scroll", menuShowing);
    return () => document.body.classList.remove("no-scroll");
  }, [menuShowing]);

  useEffect(() => {
    if (!menuShowing) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setMenuOpen(false);
      menuButtonRef.current?.focus();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [menuShowing]);

  // Replay the badge pop whenever the count grows.
  useEffect(() => {
    if (!hydrated) {
      previousCount.current = count;
      return;
    }
    if (count > previousCount.current) {
      setBump(true);
      const timer = setTimeout(() => setBump(false), 500);
      previousCount.current = count;
      return () => clearTimeout(timer);
    }
    previousCount.current = count;
  }, [count, hydrated]);

  /*
   * Before hydration the badge renders with `.has-items` off, which the
   * stylesheet already draws as scale(0). That makes the server and client
   * markup agree, and the badge scales in when the stored cart loads — an
   * on-brand transition rather than a flash of the wrong number.
   */
  const showBadge = hydrated && count > 0;
  /*
   * The unscrolled header is cream text designed to sit over the hero photo.
   * Only the homepage has that photo — anywhere else the wordmark and nav are
   * cream on cream, i.e. invisible — so off the homepage the header starts in
   * its solid, scrolled state.
   */
  const headerClass = [
    "site-header",
    scrolled || !onHome ? "scrolled" : "",
    menuShowing ? "menu-open" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <header className={headerClass} id="header">
      <div className="shell header-inner">
        <Logo label="Choice Office Furniture — home" />

        <nav
          className={`nav${menuShowing ? " open" : ""}`}
          id="nav"
          aria-label="Primary"
        >
          <ul>
            {NAV_LINKS.map((link) => {
              const isRoute = link.kind === "route";
              const href = isRoute
                ? link.href
                : onHome
                  ? `#${link.id}`
                  : `/#${link.id}`;
              const active = isRoute
                ? pathname.startsWith(link.href)
                : onHome && activeSection === link.id;

              return (
                <li key={link.id}>
                  {/* An in-page anchor stays a plain <a>: next/link would
                      intercept it and the native smooth scroll is the
                      behaviour the original had. */}
                  {isRoute ? (
                    <Link
                      href={href}
                      className={active ? "active" : undefined}
                      onClick={() => setMenuOpen(false)}
                    >
                      {link.label}
                    </Link>
                  ) : (
                    <a
                      href={href}
                      className={active ? "active" : undefined}
                      onClick={() => setMenuOpen(false)}
                    >
                      {link.label}
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="header-actions">
          <button
            type="button"
            className="icon-btn cart-btn"
            onClick={open}
            aria-label={`Open cart, ${count} ${count === 1 ? "item" : "items"}`}
            aria-haspopup="dialog"
          >
            <Icon name="i-cart" />
            <span
              className={`cart-count${showBadge ? " has-items" : ""}${bump ? " bump" : ""}`}
              aria-hidden="true"
            >
              {hydrated ? count : 0}
            </span>
          </button>

          <button
            type="button"
            ref={menuButtonRef}
            className="icon-btn menu-btn"
            aria-label={menuShowing ? "Close menu" : "Open menu"}
            aria-expanded={menuShowing}
            aria-controls="nav"
            onClick={() => setMenuOpen((value) => !value)}
          >
            <Icon name="i-menu" className="icon icon-open" />
            <Icon name="i-close" className="icon icon-close" />
          </button>
        </div>
      </div>
    </header>
  );
}

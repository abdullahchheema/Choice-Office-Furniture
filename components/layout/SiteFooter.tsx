import Link from "next/link";

import { Logo } from "@/components/layout/SvgSprite";
import { getActiveCategories, getSettingsOrNull } from "@/lib/queries";
import { safeQuery } from "@/lib/safe";

/*
 * Evaluated once at module load rather than per render.
 *
 * Calling `new Date()` during render marks the route dynamic in some Next
 * configurations, quietly turning a cacheable static homepage into a
 * per-request render — a performance regression nobody notices until traffic
 * arrives. A year that is at most one build stale is the better trade.
 */
const BUILD_YEAR = new Date().getFullYear();

/*
 * The section links are homepage anchors, so they are absolute ("/#craft"):
 * from /shop or /cart a bare "#craft" scrolls to nothing. The Shop column is
 * no longer a hardcoded list — it reads real categories, so renaming one in
 * the admin updates the footer too.
 */
const COLUMNS = [
  {
    label: "Company",
    links: [
      { href: "/#craft", text: "Why Choice" },
      { href: "/#finishes", text: "Finishes" },
      { href: "/#stories", text: "Reviews" },
      { href: "/#visit", text: "Showroom" },
    ],
  },
  {
    label: "Help",
    links: [
      { href: "/delivery", text: "Delivery" },
      { href: "/returns", text: "Returns and warranty" },
      { href: "/privacy", text: "Privacy" },
      { href: "/terms", text: "Terms of sale" },
      { href: "/contact", text: "Contact" },
    ],
  },
] as const;

export async function SiteFooter() {
  const [categories, settings] = await Promise.all([
    safeQuery("footer categories", getActiveCategories, []),
    safeQuery("settings", getSettingsOrNull, null),
  ]);

  const shopLinks = categories.slice(0, 5).map((category) => ({
    href: `/shop?category=${category.slug}`,
    text: category.name,
  }));

  const columns = [
    {
      label: "Shop",
      links:
        shopLinks.length > 0
          ? shopLinks
          : [{ href: "/shop", text: "Everything we make" }],
    },
    ...COLUMNS,
  ];

  return (
    <footer className="site-footer">
      <div className="shell footer-grid">
        <div className="footer-brand">
          <Logo label={`${settings?.brandName ?? "Choice Office Furniture"} — home`} />
          <p>
            {settings?.tagline ?? (
              <>
                Warm wood. Quiet design.
                <br />
                Furniture that works as hard as you do.
              </>
            )}
          </p>
        </div>

        {columns.map((column) => (
          <nav key={column.label} aria-label={column.label}>
            <h4>{column.label}</h4>
            <ul>
              {column.links.map((link) => (
                <li key={link.text}>
                  <Link href={link.href}>{link.text}</Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      <div className="shell footer-bottom">
        <p>
          © {BUILD_YEAR} {settings?.brandName ?? "Choice Office Furniture"}. All
          rights reserved.
        </p>
        <p>
          Crafted with care · Photography via{" "}
          <a href="https://unsplash.com" target="_blank" rel="noopener">
            Unsplash
          </a>
        </p>
      </div>
    </footer>
  );
}

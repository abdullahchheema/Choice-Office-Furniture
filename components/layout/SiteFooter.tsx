import { Logo } from "@/components/layout/SvgSprite";

/*
 * Evaluated once at module load rather than per render.
 *
 * Calling `new Date()` during render marks the route dynamic in some Next
 * configurations, quietly turning a cacheable static homepage into a
 * per-request render — a performance regression nobody notices until traffic
 * arrives. A year that is at most one build stale is the better trade.
 */
const BUILD_YEAR = new Date().getFullYear();

const COLUMNS = [
  {
    label: "Shop",
    links: [
      { href: "#shop", text: "Living" },
      { href: "#shop", text: "Dining" },
      { href: "#shop", text: "Bedroom" },
      { href: "#shop", text: "Storage & Light" },
    ],
  },
  {
    label: "Company",
    links: [
      { href: "#craft", text: "Craftsmanship" },
      { href: "#finishes", text: "Finishes" },
      { href: "#stories", text: "Reviews" },
      { href: "#visit", text: "Showroom" },
    ],
  },
  {
    label: "Help",
    links: [
      { href: "#trust", text: "Delivery" },
      { href: "#trust", text: "Returns" },
      { href: "#trust", text: "Guarantee" },
      { href: "#visit", text: "Contact" },
    ],
  },
] as const;

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="shell footer-grid">
        <div className="footer-brand">
          <Logo label="Choice Office Furniture — back to top" />
          <p>
            Warm wood. Quiet design.
            <br />
            Furniture that works as hard as you do.
          </p>
        </div>

        {COLUMNS.map((column) => (
          <nav key={column.label} aria-label={column.label}>
            <h4>{column.label}</h4>
            <ul>
              {column.links.map((link) => (
                <li key={link.text}>
                  <a href={link.href}>{link.text}</a>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      <div className="shell footer-bottom">
        <p>© {BUILD_YEAR} Choice Office Furniture. All rights reserved.</p>
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

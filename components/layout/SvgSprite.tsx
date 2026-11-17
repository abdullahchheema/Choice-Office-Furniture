/**
 * Icon sprite, inlined once in the layout so every `<use href="#i-…">`
 * resolves. Server component — this is static markup.
 *
 * Paths are copied verbatim from the original so the icons are identical.
 * `art-lounge` is the one furniture illustration still in use; the finish
 * picker recolours it through CSS custom properties.
 */
export function SvgSprite() {
  return (
    <svg
      width="0"
      height="0"
      style={{ position: "absolute" }}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <symbol id="art-lounge" viewBox="0 0 400 300">
          <ellipse className="s-sh" cx="200" cy="270" rx="115" ry="8" />
          <path className="s-fabd" d="M118 100 Q200 66 282 100 L294 196 H106 Z" />
          <rect className="s-fab" x="130" y="102" width="140" height="86" rx="28" />
          <rect className="s-fabl" x="106" y="176" width="188" height="40" rx="16" />
          <rect className="s-wd" x="90" y="130" width="20" height="96" rx="9" />
          <rect className="s-wd" x="290" y="130" width="20" height="96" rx="9" />
          <line className="l-wd" x1="120" y1="222" x2="104" y2="266" />
          <line className="l-wd" x1="280" y1="222" x2="296" y2="266" />
        </symbol>

        <symbol id="i-cart" viewBox="0 0 24 24">
          <path
            d="M3 4h2.4l2.1 11h10.2l2-8H6.2"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="9" cy="19.5" r="1.3" fill="currentColor" />
          <circle cx="17" cy="19.5" r="1.3" fill="currentColor" />
        </symbol>

        <symbol id="i-heart" viewBox="0 0 24 24">
          <path
            d="M12 20.5s-7.5-4.6-7.5-10.3A4.2 4.2 0 0 1 12 7.7a4.2 4.2 0 0 1 7.5 2.5c0 5.7-7.5 10.3-7.5 10.3z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </symbol>

        <symbol id="i-arrow" viewBox="0 0 24 24">
          <path
            d="M4 12h15M13 6l6 6-6 6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </symbol>

        <symbol id="i-menu" viewBox="0 0 24 24">
          <path
            d="M4 8h16M4 16h16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </symbol>

        <symbol id="i-close" viewBox="0 0 24 24">
          <path
            d="M6 6l12 12M18 6 6 18"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </symbol>

        <symbol id="i-truck" viewBox="0 0 24 24">
          <path
            d="M2.5 6.5h11v10h-11zM13.5 10h4l3 3v3.5h-7"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <circle cx="7" cy="17.5" r="1.8" fill="var(--cream)" stroke="currentColor" strokeWidth="1.6" />
          <circle cx="17" cy="17.5" r="1.8" fill="var(--cream)" stroke="currentColor" strokeWidth="1.6" />
        </symbol>

        <symbol id="i-leaf" viewBox="0 0 24 24">
          <path
            d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14M5 19c2-4 5-7 9-9"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </symbol>

        <symbol id="i-shield" viewBox="0 0 24 24">
          <path
            d="M12 3.5 5 6v5.5c0 4.3 3 7.6 7 9 4-1.4 7-4.7 7-9V6z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path
            d="m9 12 2.3 2.3L15.5 10"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </symbol>

        <symbol id="i-return" viewBox="0 0 24 24">
          <path
            d="M5 9h10a4 4 0 0 1 0 8H8M8.5 5.5 5 9l3.5 3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </symbol>

        <symbol id="i-pin" viewBox="0 0 24 24">
          <path
            d="M12 21s6.5-5.7 6.5-11A6.5 6.5 0 0 0 5.5 10C5.5 15.300 12 21 12 21z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <circle cx="12" cy="10" r="2.3" fill="none" stroke="currentColor" strokeWidth="1.6" />
        </symbol>

        <symbol id="i-star" viewBox="0 0 24 24">
          <path
            d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 17l-5.2 2.7 1-5.9L3.5 9.700l5.900-.8z"
            fill="currentColor"
          />
        </symbol>
      </defs>
    </svg>
  );
}

/** Convenience wrapper for a sprite icon. */
export function Icon({
  name,
  className = "icon",
}: {
  name: string;
  className?: string;
}) {
  return (
    <svg className={className} aria-hidden="true">
      <use href={`#${name}`} />
    </svg>
  );
}

/** The wordmark, used in both the header and the footer. */
export function Logo({ label }: { label: string }) {
  return (
    <a className="logo" href="#top" aria-label={label}>
      <svg className="logo-mark" viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="9" fill="currentColor" />
        <path d="M7 16.500 16 8l9 8.500V25H7z" fill="var(--oak)" />
        <rect x="13" y="17" width="6" height="8" rx="1" fill="currentColor" />
      </svg>
      <span className="logo-text">
        <span className="logo-name">Choice</span>
        <span className="logo-sub">Office Furniture</span>
      </span>
    </a>
  );
}

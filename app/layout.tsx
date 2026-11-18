import { siteUrl } from "@/lib/site-url";
import type { Metadata, Viewport } from "next";

import { SvgSprite } from "@/components/layout/SvgSprite";
import { fontVariables } from "@/lib/fonts";

import "./globals.css";

/*
 * Root layout — only what the storefront and the admin genuinely share:
 * the document shell, fonts and the icon sprite.
 *
 * The storefront's chrome (header, footer, cart drawer, scroll animations)
 * lives in app/(storefront)/layout.tsx, so the admin does not inherit a
 * shopping cart and a scroll-reveal observer it has no use for.
 */

const origin = siteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(origin),
  title: {
    default: "Choice Office Furniture — Workspaces built to last",
    template: "%s · Choice Office Furniture",
  },
  description:
    "Executive, ergonomic and mesh office chairs, desks and conference tables — built from solid materials and delivered across Pakistan.",
  openGraph: {
    type: "website",
    siteName: "Choice Office Furniture",
    locale: "en_PK",
  },
  icons: {
    icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%233B2A1E'/%3E%3Cpath d='M7 16.5 16 8l9 8.5V25H7z' fill='%23C8A06E'/%3E%3Crect x='13' y='17' width='6' height='8' rx='1' fill='%233B2A1E'/%3E%3C/svg%3E",
  },
};

export const viewport: Viewport = {
  themeColor: "#F7F1E8",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    /*
     * `js` is static rather than script-added, so the pre-animation hidden
     * states in storefront.css apply from the first paint. Adding it with a
     * script leaves one frame where the hero copy flashes at full opacity.
     */
    <html lang="en" className={`js ${fontVariables}`}>
      <body>
        <SvgSprite />
        {children}
      </body>
    </html>
  );
}

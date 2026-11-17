import type { Metadata, Viewport } from "next";

import { CartDrawer } from "@/components/cart/CartDrawer";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SvgSprite } from "@/components/layout/SvgSprite";
import { CartProvider } from "@/components/providers/CartProvider";
import { ShopFilterProvider } from "@/components/providers/ShopFilterProvider";
import { ToastProvider } from "@/components/providers/ToastProvider";
import { WishlistProvider } from "@/components/providers/WishlistProvider";
import { ReadyFlag } from "@/components/system/ReadyFlag";
import { ScrollReveal } from "@/components/system/ScrollReveal";
import { fontVariables } from "@/lib/fonts";
import { getCartCatalog, getSettingsOrNull } from "@/lib/queries";
import { safeQuery } from "@/lib/safe";

import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
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

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  /*
   * The cart stores ids and quantities only, so it needs the catalog to render
   * a line. Supplying it from the server means a price edited in the admin is
   * reflected immediately, and a cart saved last week can never show a stale
   * amount.
   */
  const [catalog, settings] = await Promise.all([
    safeQuery("cart catalog", getCartCatalog, []),
    safeQuery("settings", getSettingsOrNull, null),
  ]);

  return (
    /*
     * `js` is static rather than script-added, so the pre-animation hidden
     * states in storefront.css apply from the first paint. Adding it with a
     * script leaves one frame where the hero copy flashes at full opacity.
     */
    <html lang="en" className={`js ${fontVariables}`}>
      <body>
        <ReadyFlag />
        <ScrollReveal />
        <SvgSprite />

        <ToastProvider>
          <WishlistProvider>
            <CartProvider
              catalog={catalog}
              currencySymbol={settings?.currencySymbol ?? "Rs."}
            >
              <ShopFilterProvider>
                <a className="skip-link" href="#main">
                  Skip to content
                </a>

                <SiteHeader />
                <main id="main">{children}</main>
                <SiteFooter />
                <CartDrawer />
              </ShopFilterProvider>
            </CartProvider>
          </WishlistProvider>
        </ToastProvider>
      </body>
    </html>
  );
}

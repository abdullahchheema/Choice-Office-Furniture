import { CartDrawer } from "@/components/cart/CartDrawer";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { CartProvider } from "@/components/providers/CartProvider";
import { ShopFilterProvider } from "@/components/providers/ShopFilterProvider";
import { ToastProvider } from "@/components/providers/ToastProvider";
import { WishlistProvider } from "@/components/providers/WishlistProvider";
import { ReadyFlag } from "@/components/system/ReadyFlag";
import { ScrollReveal } from "@/components/system/ScrollReveal";
import { getCartCatalog, getSettingsOrNull } from "@/lib/queries";
import { safeQuery } from "@/lib/safe";

/** Everything the shop needs and the admin does not. */
export default async function StorefrontLayout({
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
    <>
      <ReadyFlag />
      <ScrollReveal />

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
    </>
  );
}

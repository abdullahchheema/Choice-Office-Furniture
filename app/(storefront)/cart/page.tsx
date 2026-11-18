import type { Metadata } from "next";

import { CartTable } from "@/components/cart/CartTable";
import { getSettingsOrNull } from "@/lib/queries";
import { toMoneyString } from "@/lib/money";
import { safeQuery } from "@/lib/safe";

export const metadata: Metadata = {
  title: "Your cart",
  robots: { index: false, follow: false },
};

export default async function CartPage() {
  const settings = await safeQuery("settings", getSettingsOrNull, null);

  return (
    <section className="section">
      <div className="shell shell--narrow">
        <header className="section-head" data-reveal>
          <p className="eyebrow">Step 1 of 2</p>
          <h2>Your cart</h2>
        </header>

        <CartTable
          shippingFee={toMoneyString(settings?.shippingFee ?? 0)}
          freeShippingThreshold={
            settings?.freeShippingThreshold
              ? toMoneyString(settings.freeShippingThreshold)
              : null
          }
          shippingNote={settings?.shippingNote ?? null}
        />
      </div>
    </section>
  );
}

import type { Metadata } from "next";

import { CheckoutForm } from "@/components/cart/CheckoutForm";
import { toMoneyString } from "@/lib/money";
import { getSettingsOrNull } from "@/lib/queries";
import { safeQuery } from "@/lib/safe";

export const metadata: Metadata = {
  title: "Checkout",
  robots: { index: false, follow: false },
};

export default async function CheckoutPage() {
  const settings = await safeQuery("settings", getSettingsOrNull, null);

  return (
    <section className="section">
      <div className="shell shell--narrow">
        <header className="section-head" data-reveal>
          <p className="eyebrow">Step 2 of 2</p>
          <h2>Your details</h2>
          <p className="section-sub">
            We&apos;ll save your order and open WhatsApp so you can confirm it with
            us. Nothing is charged online.
          </p>
        </header>

        <CheckoutForm
          shippingFee={toMoneyString(settings?.shippingFee ?? 0)}
          freeShippingThreshold={
            settings?.freeShippingThreshold
              ? toMoneyString(settings.freeShippingThreshold)
              : null
          }
        />
      </div>
    </section>
  );
}

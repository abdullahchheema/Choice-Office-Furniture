import { SettingsForm } from "@/components/admin/SettingsForm";
import { formatPhonePK } from "@/lib/phone";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Settings" };

export default async function AdminSettingsPage() {
  const settings = await prisma.websiteSetting.findUnique({
    where: { id: "singleton" },
  });

  if (!settings) {
    return (
      <p className="rounded-card border border-line bg-white p-6 text-sm text-text-muted">
        The settings row is missing. Run <code>npm run db:seed</code> to create it.
      </p>
    );
  }

  const placeholderNumber = settings.whatsappE164 === "+923000000000";

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink">
          Settings
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          Business details used across the storefront and on every order.
        </p>
      </header>

      {placeholderNumber ? (
        <p
          role="status"
          className="rounded-card border border-clay/40 bg-sand/40 px-5 py-4 text-sm font-semibold text-espresso"
        >
          The WhatsApp number is still the seeded placeholder. Orders will not
          reach anyone until you replace it below.
        </p>
      ) : null}

      <SettingsForm
        values={{
          brandName: settings.brandName,
          tagline: settings.tagline ?? "",
          whatsapp: settings.whatsappDisplay || formatPhonePK(settings.whatsappE164),
          phone: settings.phone ?? "",
          email: settings.email ?? "",
          addressLine: settings.addressLine ?? "",
          city: settings.city ?? "",
          openingHours: settings.openingHours ?? "",
          currencySymbol: settings.currencySymbol,
          shippingFee: settings.shippingFee.toString(),
          shippingNote: settings.shippingNote ?? "",
          facebookUrl: settings.facebookUrl ?? "",
          instagramUrl: settings.instagramUrl ?? "",
          linkedinUrl: settings.linkedinUrl ?? "",
          deliveryPolicy: settings.deliveryPolicy ?? "",
          returnPolicy: settings.returnPolicy ?? "",
          privacyPolicy: settings.privacyPolicy ?? "",
          termsPolicy: settings.termsPolicy ?? "",
        }}
      />
    </div>
  );
}

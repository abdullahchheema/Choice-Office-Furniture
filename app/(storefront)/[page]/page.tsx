import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getSettingsOrNull } from "@/lib/queries";
import { whatsappDialNumber } from "@/lib/phone";

/**
 * The information pages — contact, delivery, returns, privacy, terms.
 *
 * Their text is not in the code: it lives in WebsiteSetting and is edited at
 * /admin/settings, like everything else the shop owner might need to change.
 * Only these five slugs exist (`dynamicParams = false`); any other top-level
 * path is an ordinary 404, and real routes such as /shop win over this segment.
 */
export const dynamicParams = false;
export const revalidate = 3600;

const PAGES = {
  contact: { title: "Contact us", field: null },
  delivery: { title: "Delivery", field: "deliveryPolicy" },
  returns: { title: "Returns and warranty", field: "returnPolicy" },
  privacy: { title: "Privacy policy", field: "privacyPolicy" },
  terms: { title: "Terms of sale", field: "termsPolicy" },
} as const;

type Slug = keyof typeof PAGES;

export function generateStaticParams() {
  return (Object.keys(PAGES) as Slug[]).map((page) => ({ page }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ page: string }>;
}): Promise<Metadata> {
  const { page } = await params;
  const entry = PAGES[page as Slug];
  if (!entry) return {};

  // A page the owner has not written yet says so; it should not be indexed as
  // thin content. It becomes indexable the moment text is saved in the admin.
  const settings = entry.field ? await getSettingsOrNull() : null;
  const empty = entry.field ? !settings?.[entry.field]?.trim() : false;

  return {
    title: entry.title,
    alternates: { canonical: `/${page}` },
    ...(empty ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function InfoPage({
  params,
}: {
  params: Promise<{ page: string }>;
}) {
  const { page } = await params;
  const entry = PAGES[page as Slug];
  if (!entry) notFound();

  const settings = await getSettingsOrNull();
  const text = entry.field ? settings?.[entry.field]?.trim() : null;

  return (
    <section className="section section--flush">
      <div className="shell shell--narrow">
        <nav className="crumbs" aria-label="Breadcrumb">
          <Link href="/">Home</Link>
          <span aria-hidden="true">/</span>
          <span>{entry.title}</span>
        </nav>

        <header className="page-head" data-reveal>
          <h1>{entry.title}</h1>
        </header>

        {page === "contact" ? (
          <div className="panel">
            <dl className="spec-list">
              {settings?.whatsappDisplay ? (
                <div>
                  <dt>WhatsApp</dt>
                  <dd>
                    <a
                      href={`https://wa.me/${whatsappDialNumber(settings.whatsappE164)}`}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      {settings.whatsappDisplay}
                    </a>
                  </dd>
                </div>
              ) : null}
              {settings?.phone ? (
                <div>
                  <dt>Phone</dt>
                  <dd>{settings.phone}</dd>
                </div>
              ) : null}
              {settings?.email ? (
                <div>
                  <dt>Email</dt>
                  <dd>
                    <a href={`mailto:${settings.email}`}>{settings.email}</a>
                  </dd>
                </div>
              ) : null}
              {settings?.addressLine ? (
                <div>
                  <dt>Showroom</dt>
                  <dd>{[settings.addressLine, settings.city].filter(Boolean).join(", ")}</dd>
                </div>
              ) : null}
              {settings?.openingHours ? (
                <div>
                  <dt>Hours</dt>
                  <dd>{settings.openingHours}</dd>
                </div>
              ) : null}
            </dl>
            {settings?.mapUrl ? (
              <p style={{ marginTop: 18 }}>
                <a className="btn btn--ghost" href={settings.mapUrl} target="_blank" rel="noopener noreferrer">
                  Open in maps
                </a>
              </p>
            ) : null}
          </div>
        ) : (
          <div className="panel">
            {text ? (
              <div className="pdp-desc" style={{ whiteSpace: "pre-line" }}>
                {text}
              </div>
            ) : (
              <p className="hint">
                This page hasn&apos;t been written yet. For now, message us on WhatsApp
                {settings?.whatsappDisplay ? ` (${settings.whatsappDisplay})` : ""} and
                we&apos;ll answer any question directly.
              </p>
            )}
            {page === "delivery" && settings?.shippingNote ? (
              <p className="free-ship-note">{settings.shippingNote}</p>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}

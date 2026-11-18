/**
 * The public origin of the site, used for canonical URLs, the sitemap, robots
 * and links inside WhatsApp messages.
 *
 * In production it MUST be set (see scripts/check-env.mjs): falling back to
 * localhost would put `http://localhost:3000` into every canonical tag and
 * sitemap entry, which search engines then index.
 */
export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

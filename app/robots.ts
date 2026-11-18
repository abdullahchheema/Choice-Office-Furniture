import type { MetadataRoute } from "next";

import { siteUrl } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Private or per-visitor pages. These also send `X-Robots-Tag: noindex`
        // (next.config.ts), because robots.txt only discourages crawling — a
        // disallowed URL can still be indexed if something links to it.
        disallow: ["/admin", "/api/", "/cart", "/checkout", "/orders/"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}

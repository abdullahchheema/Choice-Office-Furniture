import type { NextConfig } from "next";

/**
 * The Supabase Storage host is project-specific, so derive it from the env
 * rather than hardcoding — otherwise staging silently 400s on every image.
 */
const supabaseHost = (() => {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) return null;
  try {
    return new URL(raw).hostname;
  } catch {
    return null;
  }
})();

/*
 * Response headers for every route.
 *
 * The CSP is deliberately limited to directives that need no script or style
 * allow-list: frame-ancestors (clickjacking — the admin must never render in
 * someone else's iframe), base-uri, form-action, object-src. A full
 * script-src policy needs per-request nonces to coexist with Next's inline
 * bootstrap scripts, which is worth doing but is not a safe one-line change.
 */
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
  },
  // Only honoured over HTTPS, so harmless on localhost.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,

  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // robots.txt only discourages crawling; this is what actually keeps
      // private and per-visitor pages out of search results.
      ...["/admin/:path*", "/cart", "/checkout", "/orders/:path*"].map((source) => ({
        source,
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      })),
    ];
  },

  /**
   * Next 16's create-next-app turns Cache Components on by default. It is
   * deliberately off here: it makes every dynamic read (cookies/headers/
   * searchParams) require a Suspense boundary, and the admin dashboard reads
   * the session cookie on literally every page while needing always-fresh
   * data. Ordinary route-level `revalidate` + `revalidateTag` covers the
   * storefront caching we actually want, with none of that ceremony.
   */
  cacheComponents: false,

  /**
   * Dev only. Next 16 refuses client JS and the HMR socket to any origin other
   * than `localhost`, so a page opened at http://127.0.0.1:3000 loads as plain,
   * un-hydrated HTML — forms still post, but nothing interactive works. Listing
   * the loopback address makes both spellings behave identically. It has no
   * effect on production builds.
   */
  allowedDevOrigins: ["127.0.0.1"],

  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },

  images: {
    // Pin the bucket PATH, not just the host. A bare hostname pattern turns the
    // image optimizer into an open proxy for everything in the Supabase project.
    remotePatterns: supabaseHost
      ? [
          {
            protocol: "https",
            hostname: supabaseHost,
            pathname: "/storage/v1/object/public/product-images/**",
          },
        ]
      : [],
    formats: ["image/avif", "image/webp"],
    // 2400 is kept because the hero ships a 2400w asset; dropping that
    // breakpoint visibly softens the hero on large displays.
    deviceSizes: [360, 420, 640, 828, 1080, 1200, 1920, 2400],
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },
};

export default nextConfig;

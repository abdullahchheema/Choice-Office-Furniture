import type { Metadata, Viewport } from "next";

import { ReadyFlag } from "@/components/system/ReadyFlag";
import { fontVariables } from "@/lib/fonts";

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
};

export const viewport: Viewport = {
  themeColor: "#F7F1E8",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    /*
     * `js` is a static attribute rather than something a script adds, so the
     * pre-animation hidden states in storefront.css apply from the very first
     * paint — a script-added class leaves one unstyled frame where the hero
     * copy flashes at full opacity before hiding.
     */
    <html lang="en" className={`js ${fontVariables}`}>
      <body>
        <ReadyFlag />
        {children}
      </body>
    </html>
  );
}

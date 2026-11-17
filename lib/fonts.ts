import { Fraunces, Plus_Jakarta_Sans } from "next/font/google";

/**
 * Display face.
 *
 * `axes: ["opsz"]` is REQUIRED, not cosmetic. storefront.css sets
 * `font-variation-settings: "opsz" 96` on every h1/h2/h3. Without the axis
 * declared here next/font serves a weight-only instance, the declaration
 * silently does nothing, and every heading on the site loses its optical
 * sizing — which reads as "the font looks slightly off" rather than an error.
 *
 * `weight` is deliberately omitted so the full variable range ships: the
 * stylesheet uses 700, 800 and 900, plus italic for the `em` accents.
 */
export const fraunces = Fraunces({
  subsets: ["latin"],
  axes: ["opsz"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-fraunces",
});

/** Body face — variable, full weight range (the stylesheet uses 500–800). */
export const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-plus-jakarta",
});

export const fontVariables = `${fraunces.variable} ${plusJakarta.variable}`;

import "server-only";

import { cookies } from "next/headers";

/**
 * Who may read an order's details on the public confirmation page.
 *
 * Order references are sequential and human-readable on purpose — customers
 * read them out over the phone — which means they are also trivially
 * guessable. `/orders/ORD-2026-0001` carrying a name, phone number and home
 * address would therefore be an enumerable leak of every customer's details.
 *
 * So the page shows personal details only to the browser that placed the
 * order: on success the checkout records the reference in an httpOnly cookie,
 * and anyone else sees the reference and status alone. No schema change and no
 * token in the URL (which would end up in history, screenshots and referrers).
 *
 * This is a privacy boundary, not an auth boundary — the admin dashboard is
 * where orders are actually managed, behind a real session.
 */

const COOKIE = "cof_orders";
const MAX_REMEMBERED = 20;
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export async function rememberOrder(orderNumber: string): Promise<void> {
  const jar = await cookies();
  const current = parse(jar.get(COOKIE)?.value);

  // Newest first, deduped, capped — a cookie is not a database.
  const next = [orderNumber, ...current.filter((n) => n !== orderNumber)].slice(
    0,
    MAX_REMEMBERED,
  );

  jar.set(COOKIE, next.join(","), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function placedByThisBrowser(orderNumber: string): Promise<boolean> {
  const jar = await cookies();
  return parse(jar.get(COOKIE)?.value).includes(orderNumber);
}

function parse(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((part) => part.trim())
    // Shape-checked rather than trusted: the value is a cookie, so it is
    // client-supplied, and it is used in a string comparison only.
    .filter((part) => /^[A-Z0-9]{1,8}-\d{4}-\d{4,8}$/.test(part));
}

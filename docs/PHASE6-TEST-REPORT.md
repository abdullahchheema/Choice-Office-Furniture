# Phase 6 — testing and hardening report

Run against the real Supabase database and a running dev server. Every test
row was removed afterwards (orders, customers, rate-limit buckets, stock
adjustments); the catalogue was left exactly as seeded.

## Defects found and fixed

| # | Found by | Defect | Fix |
|---|----------|--------|-----|
| 1 | header probe | No security headers at all (clickjacking on `/admin`, MIME sniffing, referrer leakage) | `next.config.ts`: X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy, HSTS, a CSP limited to directives needing no script allow-list; `X-Powered-By` removed |
| 2 | URL fuzz | `/shop?page=99999999999999999999` returned **500** (overflowed Postgres' 32-bit OFFSET) | page clamped to 1…10,000 |
| 3 | URL fuzz | `/shop?q=%00` returned **500** (Postgres rejects NUL bytes) | control characters stripped; array-valued params tolerated |
| 4 | UI replay | A product unpublished while in a cart made checkout fail with "remove it" for an item the customer **could not see** | cart submits only the lines it displays |

| 5 | **Phase 7 audit** (missed by every Phase 6 test, which went through the app) | **The public Supabase anon key had full read/write on every table** — it could read `admin_users` including the password hash, would have exposed every customer's name/phone/address, and could insert and delete rows. Supabase exposes `public` over REST and grants anon access by default. | Migration `20261118120000_lock_down_public_schema`: RLS on for every table, anon/authenticated grants revoked (the app connects as the owner, which bypasses RLS). `npm run security:audit` proves it; run it after any migration that adds a table. |

> Lesson recorded: tests that exercise the app cannot find a hole that sits *beside* it. The audit for this class of problem has to probe the database's other doors directly.

## Passed without changes

**Authentication** — every `/admin/*` route redirects; forged, `alg=none` and empty
session cookies rejected; the upload endpoint refuses without a session.
Server Actions replayed **with no session at non-admin URLs** (bypassing the
middleware) changed nothing, while the identical request with a valid session
succeeded (control). Login locks after 5 failures and refuses even the correct
password while locked; response time for a real and a non-existent account is
indistinguishable once warm.

**Checkout input (24 hostile/malformed payloads)** — quantities 0, −1, 1.5, "2",
100, 1e9; empty/malformed/null/61-line carts; unknown variant; bad email;
landline and lettered phones; over-length name/note; short/long idempotency
keys; over-stock. All rejected with a readable message and no order.
Price tampering (`unitPrice: 1.00` injected) is ignored — priced from the DB.

**Concurrency** — 8 simultaneous submissions with one idempotency key produced
exactly **one** order and consumed one order number (no gaps). Per-phone rate
limit trips at exactly the 7th order in an hour.

**Uploads (13 attacks)** — SVG/HTML/GIF/random/empty files, a 56-megapixel
decompression bomb, a 9 MB file, missing fields, unknown product, cross-origin
`Origin`, hostile filename. All rejected (415/422/413/400/404/403) except the
two valid images, which were accepted; a PNG with `<script>` appended was
re-encoded to a 244-byte WebP containing no script. The storage key is
generated, never derived from the filename. A `variantId` belonging to another
product is refused.

**Integrity** — order numbers gapless and unique; one order per idempotency
key; `customer.orderCount` matches real counts; every order total equals its
lines plus shipping; pending orders do not touch stock; confirming and
cancelling an order whose product is draft and variant inactive still moves
stock correctly; old orders keep rendering name, SKU and price after their
product is unpublished.

**Responsive / motion** — no horizontal overflow at 375 px on the product page,
cart, checkout, shop and home; touch targets ≥ 40 px. Reduced motion is honoured
in CSS (both stylesheets) and JS (count-up, parallax, filter transition).
*Reduced motion was verified by code audit, not by emulating the media query.*

## Known limitations (not fixed, by decision)

- **Lockout reveals account existence.** After 5 failures the message changes to
  "Account locked", which a prober could use to confirm an email exists. It also
  lets someone lock the owner out for 15 minutes. Acceptable for a single-owner
  admin; revisit with per-IP lockout buckets if more staff accounts are added.
- **CSP has no `script-src`.** Doing it properly needs per-request nonces to
  coexist with Next's inline bootstrap scripts; not a safe one-line change.
- **Rate limits are keyed on `X-Forwarded-For`.** Correct behind a trusted proxy
  (Vercel/Cloudflare); spoofable if the app is ever exposed directly.
- **Admin pages were not checked at phone width** (storefront only).
- **No automated test suite.** Everything above is repeatable by hand but is not
  wired into CI.

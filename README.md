# Choice Office Furniture

A complete office-furniture shop: a public storefront, a secure admin dashboard, and **WhatsApp checkout** instead of a payment gateway.

Next.js 16 (App Router) · TypeScript · Tailwind v4 · PostgreSQL on Supabase via Prisma 7 · Supabase Storage for photos.

## What it does

**Storefront** — catalogue with category, price, availability, search, sort and paging; premium product pages with image galleries; a cart; a checkout that **saves the order to the database first**, then hands the customer to WhatsApp with the order already written out.

**Products** — *simple* (one price, one stock count) or *variable* (colour, material, size, configuration — any options you invent). Every variant has its own SKU, regular and compare-at price (the discount % and sale badge are calculated), stock, photos and specifications.

**Admin** (`/admin`) — overview, products and variants, categories, orders with a status workflow, customers, inventory with a full ledger, homepage content, website settings (including the WhatsApp number), and profile.

**Inventory** — stock is per variant and only moves when an order is **confirmed**, restoring on cancellation. Every change is written to a ledger that must reconcile with the stored figure.

## Quick start (development)

Requires Node ≥ 20.9 and a Supabase project (Postgres + a Storage bucket).

```bash
npm install
cp .env.example .env.local        # then fill it in — every value is documented inside
npm run check:env                 # validates it before anything else fails confusingly
npm run db:deploy                 # apply migrations
npm run db:seed                   # categories, settings, demo catalogue, first admin
npm run dev                       # http://localhost:3000
```

Sign in at `/admin/login` with `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`. Set your real WhatsApp number at **Admin → Settings** — until you do, the dashboard shows a warning, because customers would be sent to a placeholder.

> Two connection strings are required and they differ: the app uses the **transaction pooler (port 6543)**; migrations need the **direct connection (port 5432)**. The database password is under *Supabase → Project Settings → Database* and is not any of the API keys.

## Commands

| | |
|---|---|
| `npm run dev` / `build` / `start` | develop, build (generates the Prisma client first), serve |
| `npm run typecheck` / `lint` | static checks |
| `npm run check:env` / `check:env:prod` | validate the environment (the second is what a live deploy needs) |
| `npm run db:deploy` | apply migrations (production-safe) |
| `npm run db:migrate` | create/apply migrations in development |
| `npm run db:seed` | seed data; `SEED_CATALOG=none` skips the demo products |
| `npm run admin:create -- --email you@shop.pk` | create an admin (hidden password prompt); `--reset` to set a new password |
| `npm run security:audit` | prove the public Supabase key can reach nothing |
| `npm run db:studio` | browse the data |

## Deploying

See **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)** — environment, migrations, first admin, Supabase hardening, and the post-launch checklist.

## Architecture notes

- **Money is `Decimal(12,2)` everywhere**, never a float, and is computed server-side. The cart stores variant ids and quantities only; checkout re-reads every price from the database, so a tampered client price changes nothing.
- **Two-layer admin auth.** `proxy.ts` redirects signed-out visitors (a UX convenience, not the boundary). `requireAdmin()` re-checks the session *and the database* in every admin page, Server Action and route handler — a Server Action is its own HTTP entry point and can be called without visiting its page. `sessionEpoch` revokes stateless tokens instantly.
- **Order references and privacy.** `ORD-2026-0001` is sequential and therefore guessable, so personal details are shown only to the browser that placed the order.
- **Variants are the sellable unit.** A simple product is a product with one default variant, so the cart, orders and ledger never branch on product type. `Product.minPrice` is a denormalised sort key kept in step by `syncProductSummary()`.
- **Uploads** are sniffed by magic bytes (not extension or MIME), re-encoded to WebP through `sharp`, size- and pixel-capped, and stored under generated keys.
- **Row-level security is on for every table** and the anon/authenticated roles are revoked — see below.

### Prisma 7 specifics

`url`/`directUrl` are gone from `schema.prisma`: the CLI connection is in `prisma.config.ts` (→ `DIRECT_URL`), the runtime connection is a driver adapter in `lib/prisma.ts` (→ pooled `DATABASE_URL`). The CLI does not read `.env`, so the config loads `.env.local` itself. CLI and client are pinned to the same exact version — npm's `latest` for the CLI is currently an `8.0.0` release candidate, so change both together or neither.

### Supabase lock-down

Supabase exposes every table in `public` over REST and the anon key is public. A fresh Supabase table is readable and writable by that key. The migration `20261118120000_lock_down_public_schema` enables RLS on every table and revokes the grants; the app is unaffected because Prisma connects as the table owner. **A table added by a future migration does not inherit this** — run `npm run security:audit` after adding one.

### Styling

`app/storefront.css` is the original stylesheet ported near-verbatim; `app/commerce.css` holds the commerce surfaces added later. Both are imported into `layer(components)`: unlayered CSS beats *all* layered CSS, so importing them plainly would make `.btn` defeat every Tailwind utility. Three legacy names were changed because they collided silently with Tailwind/shadcn (`--muted`→`--text-muted`, `--radius`→`--radius-card`, `.container`→`.shell`); `.field` is also taken (newsletter pill) so forms use `.form-field`. `scripts/design-fingerprint.js` snapshots computed styles for regression checks.

## Quality record

`docs/PHASE6-TEST-REPORT.md` lists what was attacked, what broke and was fixed, and the known limitations — including the ones that were deliberately left.

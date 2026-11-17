# Choice Office Furniture

Office furniture storefront and admin dashboard — Next.js 16, TypeScript, Tailwind v4, PostgreSQL (Supabase) via Prisma, with WhatsApp checkout instead of a payment gateway.

> **Status: Phase 1 of 7 (scaffold).** The storefront migration, database, admin dashboard and checkout land in the phases that follow. See `.claude/plans/` for the full plan.

---

## Requirements

- Node.js ≥ 20.9 (developed on 24.17)
- npm (no pnpm/yarn/bun lockfiles in this repo)
- A Supabase project — Postgres plus a Storage bucket

## Setup

```bash
npm install
```

Then create `.env.local` from the template and fill it in:

```bash
cp .env.example .env.local
```

Every value is documented in `.env.example`. Two notes that cost time if missed:

- **`DATABASE_URL` and `DIRECT_URL` are both required and are different.** The app talks to Supabase through the transaction pooler on port **6543**; `prisma migrate` cannot use it (no prepared statements) and needs the direct connection on port **5432**. The database password is under *Supabase → Project Settings → Database*, and is **not** any of the API keys.
- **`SUPABASE_SERVICE_ROLE_KEY` bypasses row-level security.** It is server-only: no `NEXT_PUBLIC_` prefix, never imported into a client component. `.env.local` is gitignored — keep it that way.

Generate the admin session signing key with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

## Running

```bash
npm run dev       # http://localhost:3000
npm run legacy    # http://127.0.0.1:5174 — the pre-migration static site
npm run build
npm run typecheck
npm run lint
```

`npm run legacy` serves the original static site from `legacy/`, which exists purely as the visual reference for the migration. It is deleted in Phase 7. Use `127.0.0.1` rather than `localhost`: Python binds IPv4 only, and on Windows `localhost` can resolve to IPv6.

## Database (from Phase 3)

```bash
npm run db:migrate    # create/apply migrations in development
npm run db:seed       # categories, settings, first admin, starter catalog
npm run db:studio     # browse the data
npm run db:deploy     # apply migrations in production
```

Prisma's CLI and client are pinned to the **same exact version (7.10.1)** on purpose: npm's `latest` tag for the `prisma` CLI is currently an `8.0.0` release candidate while `@prisma/client` is on stable `7.10.1`, so an unpinned install produces a CLI/client mismatch. Change both together or neither.

## Layout

```
app/
  globals.css        brand tokens (@theme), legacy aliases, shadcn semantic layer
  storefront.css     the original stylesheet, ported near-verbatim
  layout.tsx         fonts, <html class="js">, providers
components/
lib/
legacy/              pre-migration static site — reference only, removed in Phase 7
public/assets/       decorative imagery (hero, craft, showroom)
prisma/              schema, migrations, seed  (Phase 3)
```

### Two token renames worth knowing about

`storefront.css` is the original stylesheet with its `:root` block removed and exactly two names changed, because both collided with shadcn/ui:

| Original | Now | Why |
|---|---|---|
| `--muted` | `--text-muted` | The storefront uses it as a *text* colour; shadcn uses `--muted` as a *surface*. Left alone, every piece of secondary copy renders beige-on-beige. |
| `--radius` | `--radius-card` | Storefront `22px` vs shadcn `0.625rem`. Left alone, every card, tile and the cart drawer silently lose their corner radius. |

`storefront.css` is imported into `layer(components)`. That is deliberate: unlayered CSS beats *all* layered CSS, so importing it plainly would make `.btn` defeat every Tailwind utility. In `components`, Tailwind's preflight loses to the storefront and utilities still win over it.

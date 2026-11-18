# Deployment guide

Written for **Vercel + Supabase**, which is what this project was built against. Any Node host works; the host-specific parts are marked.

## 0. What you need

- A Supabase project (Postgres + Storage). Pick the region nearest your customers — this project uses `ap-south-1` (Mumbai) for Pakistan.
- A Vercel account (or any Node ≥ 20.9 host) and your domain.
- Node ≥ 20.9 locally, for running migrations and creating the admin.

## 1. Supabase

1. **Storage bucket.** Storage → New bucket → name `product-images` → **Public**. Uploads happen server-side with the service-role key; the bucket only needs to be publicly *readable* so photos can be served.
2. **Connection strings.** Project Settings → Database. You need both:
   - **Transaction pooler, port 6543** → `DATABASE_URL` (add `?pgbouncer=true&connection_limit=1`)
   - **Direct / session, port 5432** → `DIRECT_URL`

   Special characters in the password must be percent-encoded.
3. **API keys.** Project Settings → API: the project URL, the `anon` key, and the `service_role` key.

> The `service_role` key bypasses row-level security. Treat it as a root password: server-side only, never in a `NEXT_PUBLIC_` variable, never committed. If it has ever been pasted into a chat, a ticket or a shared file, **rotate it** (Project Settings → API) before launch.

## 2. Environment variables

Set these on the host (Vercel → Project → Settings → Environment Variables → *Production*):

| Variable | Value |
|---|---|
| `DATABASE_URL` | pooler URL, port 6543 |
| `DIRECT_URL` | direct URL, port 5432 (needed by `prisma generate` at build, and by migrations) |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | the service-role key |
| `SUPABASE_STORAGE_BUCKET` | `product-images` |
| `STORAGE_DRIVER` | `supabase` (**never** `local` on a serverless host — the disk is discarded on every deploy) |
| `AUTH_SECRET` | 32+ random characters: `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"` |
| `NEXT_PUBLIC_SITE_URL` | the real public origin, e.g. `https://choiceoffice.pk` — it feeds canonical tags, the sitemap and the link in every WhatsApp message |

Do **not** set `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` in production (see step 4).

Check before you deploy — the same variables in a local file, or exported in your shell:

```bash
npm run check:env:prod
```

It fails on a pooled URL used for migrations, a localhost site URL, a short signing key, a placeholder left in, and any secret behind a `NEXT_PUBLIC_` prefix.

## 3. Migrate the database

Run from your machine (or CI) against the **direct** connection — not from the build, so two concurrent builds can never race:

```bash
npm run db:deploy
```

This applies every migration in `prisma/migrations/`, including the one that turns on row-level security. Then confirm the public key can reach nothing:

```bash
npm run security:audit      # must print PASS
```

Initial content (settings, categories, homepage text — **without** the demo products):

```bash
SEED_CATALOG=none npm run db:seed      # PowerShell: $env:SEED_CATALOG="none"; npm run db:seed
```

(Omit `SEED_CATALOG=none` only if you want the demo catalogue on a staging site.)

## 4. Create the first admin

```bash
npm run admin:create -- --email owner@yourshop.pk --name "Store Owner"
```

It prompts twice for a password (minimum 12 characters, never echoed, never in shell history). To set a new password later — which also signs out every existing session — add `--reset`.

## 5. Deploy

Vercel: import the repo. Framework preset **Next.js**; the build command is `npm run build` (it runs `prisma generate` first). Deploy.

Notes:

- The homepage, `/cart` and `/checkout` are prerendered at build, so **the database must be reachable during the build** and migrated first. Admin saves refresh the storefront on demand; the homepage also revalidates daily as a backstop.
- Rate limiting reads the client address from `X-Forwarded-For`. That is correct on Vercel and behind Cloudflare; it would be spoofable if the Node server were exposed directly to the internet. Keep it behind a trusted proxy.
- HTTPS is assumed: session cookies are `Secure` in production and HSTS is sent.

## 6. Post-launch checklist

Do these in order, the first day:

- [ ] **Admin → Settings → WhatsApp number** — set your real number. Until you do, the dashboard shows a red warning and customers are sent to a placeholder.
- [ ] Settings: currency symbol, delivery fee / free-delivery threshold, address, hours, and the four policy texts (they appear at `/delivery`, `/returns`, `/privacy`, `/terms`).
- [ ] **Place a real test order** end to end: add a product, check out, tap *Open WhatsApp*, confirm the message arrives on your phone with the right items and SKU; then in Admin → Orders **confirm** it and check the stock dropped, **cancel** it and check it came back.
- [ ] `https://<your-domain>/sitemap.xml` and `/robots.txt` render with your real domain. Submit the sitemap to Google Search Console.
- [ ] Replace the demo products with real ones (or delete them), and upload real photos.
- [ ] Rotate the Supabase service-role key if it was ever shared, and update it on the host.
- [ ] Re-run `npm run security:audit` against production.
- [ ] Turn on Supabase backups (Project Settings → Database → Backups; point-in-time recovery needs a paid plan).

## 7. Operating it

**Order flow.** A customer's order is saved as *Pending confirmation* **before** WhatsApp opens, so an order exists even if the chat never starts. The dashboard's first widget is the pending count; orders whose WhatsApp was never opened are leads to phone. Confirm → Processing → Ready → Shipped → Delivered; cancelling a confirmed order restores stock.

**Stock.** Per variant, adjusted from the product's variant card or Admin → Inventory, always through the ledger. *Ledger reconciliation* at the top of the Inventory page must read "Balanced".

**Adding a table in a future migration?** It will be readable by the public key until you enable row-level security on it. Run `npm run security:audit` after every migration that creates a table.

**Changing the schema.** `npm run db:migrate` in development, commit the generated migration, then `npm run db:deploy` against production *before* deploying the code that needs it.

## 8. Troubleshooting

| Symptom | Cause |
|---|---|
| `prisma migrate` hangs or errors about prepared statements | `DIRECT_URL` points at the pooler (6543). Use 5432. |
| Build fails at `prisma generate` with an env error | `DIRECT_URL` not set on the host. |
| Homepage says "The catalog is on its way" after deploy | The build couldn't reach the database (or it wasn't migrated/seeded). Fix, then redeploy or save anything in the admin. |
| Photos upload but don't display | Bucket isn't public, or `NEXT_PUBLIC_SUPABASE_URL` is wrong. |
| Everyone is signed out after a deploy | `AUTH_SECRET` changed. Keep it stable. |
| Canonical URLs / sitemap show `localhost` | `NEXT_PUBLIC_SITE_URL` unset at **build** time — it is inlined during the build, so redeploy after setting it. |
| Admin works on `localhost` but pages are blank on `127.0.0.1` in dev | Next only trusts `localhost` for dev resources; `allowedDevOrigins` in `next.config.ts` already includes `127.0.0.1`. |

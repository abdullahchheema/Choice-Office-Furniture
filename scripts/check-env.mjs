/**
 * Validates the environment before it can bite.
 *
 *   npm run check:env                 # reads .env.local, checks for development
 *   npm run check:env -- --production # stricter: what a live deploy needs
 *
 * On a host (Vercel, a VPS) the variables come from the platform rather than a
 * file; the script falls back to process.env, so it can run as a build step.
 *
 * Every rule here corresponds to a failure that is silent or confusing at
 * runtime: a pooled URL used for migrations, a localhost canonical URL in
 * production, a short signing key, a service-role key that leaked into a
 * NEXT_PUBLIC_ variable.
 */
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
config({ quiet: true });

const production = process.argv.includes("--production") || process.env.NODE_ENV === "production";
const env = process.env;
const errors = [];
const warnings = [];

const get = (name) => (env[name] ?? "").trim();
const isPlaceholder = (v) => /^<.*>$/.test(v) || /<[A-Z_]+>/.test(v) || v === "";

function need(name, why) {
  const v = get(name);
  if (isPlaceholder(v)) {
    errors.push(`${name} is missing or still a placeholder — ${why}`);
    return null;
  }
  return v;
}

// ---- database ----
const db = need("DATABASE_URL", "the app's runtime connection (Supabase pooler, port 6543)");
const direct = need("DIRECT_URL", "migrations and the seed cannot use the pooler (port 5432)");
if (db) {
  try {
    const u = new URL(db);
    if (!/^postgres(ql)?:$/.test(u.protocol)) errors.push("DATABASE_URL must be a postgresql:// URL");
    if (u.port === "6543" && !u.searchParams.has("pgbouncer")) {
      warnings.push("DATABASE_URL uses the pooler (6543) without ?pgbouncer=true — add it, or prepared statements will fail intermittently");
    }
    if (production && u.port === "5432" && /pooler\.supabase\.com/.test(u.host)) {
      warnings.push("DATABASE_URL is the session-mode pooler (5432). Serverless hosts open many short connections; use the transaction pooler on 6543");
    }
  } catch {
    errors.push("DATABASE_URL is not a valid URL (special characters in the password must be percent-encoded)");
  }
}
if (direct) {
  try {
    if (new URL(direct).port === "6543") errors.push("DIRECT_URL points at port 6543 (the transaction pooler). Migrations need the direct/session connection on 5432");
  } catch {
    errors.push("DIRECT_URL is not a valid URL (percent-encode special characters in the password)");
  }
}
if (db && direct && db === direct) warnings.push("DATABASE_URL and DIRECT_URL are identical — fine locally, but production should pool the runtime connection");

// ---- supabase / storage ----
const sbUrl = need("NEXT_PUBLIC_SUPABASE_URL", "Supabase project URL");
if (sbUrl && !/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(sbUrl)) warnings.push("NEXT_PUBLIC_SUPABASE_URL does not look like https://<ref>.supabase.co");
need("NEXT_PUBLIC_SUPABASE_ANON_KEY", "browser-safe key");
const driver = get("STORAGE_DRIVER") || "supabase";
if (!["supabase", "local"].includes(driver)) errors.push(`STORAGE_DRIVER must be "supabase" or "local", got "${driver}"`);
if (driver === "local" && production) errors.push('STORAGE_DRIVER="local" writes to disk, which serverless hosts discard on every deploy — use "supabase"');
if (driver === "supabase") {
  need("SUPABASE_SERVICE_ROLE_KEY", "server-side uploads (it bypasses row-level security — keep it secret)");
  need("SUPABASE_STORAGE_BUCKET", "the public bucket product photos are stored in");
}
// A service-role key must never be readable by the browser.
for (const name of Object.keys(env)) {
  if (/^NEXT_PUBLIC_/.test(name) && /SERVICE|SECRET|PASSWORD/i.test(name)) {
    errors.push(`${name} starts with NEXT_PUBLIC_ and looks like a secret — that prefix ships it to every visitor's browser`);
  }
}

// ---- auth ----
const secret = need("AUTH_SECRET", "signs admin session tokens");
if (secret) {
  if (secret.length < 32) errors.push("AUTH_SECRET is under 32 characters");
  else if (/^(secret|changeme|password|dev)/i.test(secret)) errors.push("AUTH_SECRET looks like a default value");
}

// ---- site ----
const site = get("NEXT_PUBLIC_SITE_URL");
if (production) {
  if (isPlaceholder(site) || /localhost|127\.0\.0\.1/.test(site)) {
    errors.push("NEXT_PUBLIC_SITE_URL must be the real public https URL in production — it feeds canonical tags, the sitemap and the link in every WhatsApp message");
  } else if (!site.startsWith("https://")) {
    errors.push("NEXT_PUBLIC_SITE_URL must use https in production");
  } else if (new URL(site).pathname !== "/") {
    warnings.push("NEXT_PUBLIC_SITE_URL should be a bare origin without a path");
  }
} else if (isPlaceholder(site)) {
  warnings.push("NEXT_PUBLIC_SITE_URL is unset; localhost:3000 will be assumed");
}

// ---- seed-only values must not linger in production ----
if (production && get("SEED_ADMIN_PASSWORD") && !isPlaceholder(get("SEED_ADMIN_PASSWORD"))) {
  warnings.push("SEED_ADMIN_PASSWORD is set in a production environment. Create the admin with `npm run admin:create` and remove it from the host's variables");
}

const tag = production ? "production" : "development";
for (const w of warnings) console.log(`WARN   ${w}`);
for (const e of errors) console.log(`ERROR  ${e}`);
if (errors.length === 0) {
  console.log(`\nOK — environment looks right for ${tag}${warnings.length ? ` (${warnings.length} warning${warnings.length === 1 ? "" : "s"})` : ""}.`);
} else {
  console.log(`\nFAIL — ${errors.length} problem${errors.length === 1 ? "" : "s"} for ${tag}.`);
  process.exit(1);
}

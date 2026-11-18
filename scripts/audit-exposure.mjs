/**
 * Security audit: can the PUBLIC anon key reach any data?
 *
 * Supabase exposes every table in `public` over REST, and the anon key is
 * shipped to every browser. This probes every table with that key, trying to
 * read and to insert. Anything other than a refusal is a failure.
 *
 *   npm run security:audit
 *
 * Run it after every migration that adds a table: a new table does NOT get
 * row-level security automatically.
 */
import { config } from "dotenv";
import pg from "pg";

config({ path: ".env.local", quiet: true });
config({ quiet: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const direct = process.env.DIRECT_URL;
if (!url || !key || !direct) {
  console.error("NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and DIRECT_URL are required.");
  process.exit(2);
}

const db = new pg.Client({ connectionString: direct });
await db.connect();
const tables = (await db.query(`select tablename from pg_tables where schemaname='public' order by 1`)).rows.map((r) => r.tablename);
const noRls = (await db.query(`select relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity`)).rows.map((r) => r.relname);
await db.end();

const h = { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json" };
let leaks = 0;
for (const t of tables) {
  const read = await fetch(`${url}/rest/v1/${t}?select=*&limit=1`, { headers: h });
  const body = await read.json().catch(() => null);
  const canRead = read.ok && Array.isArray(body) && body.length > 0;
  // An empty table answers 200 [] when readable and 401/403/404 when not, so status is the signal.
  const readable = read.ok;
  const write = await fetch(`${url}/rest/v1/${t}`, { method: "POST", headers: { ...h, prefer: "return=minimal" }, body: "{}" });
  const writable = write.status < 400 || (write.status >= 400 && ![401, 403, 404].includes(write.status));
  const bad = readable || writable;
  if (bad) leaks += 1;
  console.log(`${bad ? "EXPOSED" : "ok     "} ${t.padEnd(28)} read:${read.status} write:${write.status}${canRead ? " (rows visible!)" : ""}`);
}
if (noRls.length) console.log(`\nTables without row-level security: ${noRls.join(", ")}`);
console.log(leaks === 0 && noRls.length === 0 ? "\nPASS — the anon key can reach nothing." : `\nFAIL — ${leaks} exposed table(s), ${noRls.length} without RLS.`);
process.exit(leaks === 0 && noRls.length === 0 ? 0 : 1);

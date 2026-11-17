import { config as loadEnv } from "dotenv";
import { defineConfig, env } from "prisma/config";

/*
 * Prisma 7 does not read .env files on its own, and Next keeps local secrets in
 * .env.local rather than .env — so without this the CLI sees no connection
 * string at all. .env.local wins; .env is a fallback for CI.
 */
loadEnv({ path: ".env.local" });
loadEnv();

export default defineConfig({
  schema: "prisma/schema.prisma",

  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },

  datasource: {
    /*
     * DIRECT_URL (port 5432), not the pooled DATABASE_URL.
     *
     * Supabase's transaction pooler on 6543 does not support prepared
     * statements or CREATE INDEX CONCURRENTLY, so `prisma migrate` fails
     * against it in ways that are hard to read. The application itself still
     * uses the pooled connection — see lib/prisma.ts.
     */
    url: env("DIRECT_URL"),
  },
});

import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

/*
 * Prisma 7 takes its runtime connection from a driver adapter rather than the
 * schema. This one uses the POOLED url (PgBouncer, port 6543) — the opposite
 * of prisma.config.ts, which uses the direct connection for migrations.
 *
 * `connection_limit=1` belongs in that URL for serverless deployment: each
 * instance holds its own pool, and Supabase's connection ceiling is low.
 */
function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env.local and fill in the " +
        "Supabase connection strings (Project Settings -> Database).",
    );
  }

  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    log:
      process.env.NODE_ENV === "development"
        ? ["warn", "error"]
        : ["error"],
  });
}

/*
 * Reuse one client across hot reloads. Without this, every edit in dev opens a
 * fresh pool and Supabase starts refusing connections within a few minutes.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

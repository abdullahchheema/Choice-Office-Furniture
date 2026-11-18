import "server-only";

import { createHash } from "node:crypto";
import { headers } from "next/headers";

import { prisma } from "@/lib/prisma";

/**
 * Fixed-window rate limiting, backed by Postgres.
 *
 * No Redis: this scale does not justify another service, and an in-memory
 * counter would be per-instance and therefore trivially bypassable on a
 * serverless host. The counter row is incremented with a single atomic
 * INSERT … ON CONFLICT DO UPDATE … RETURNING.
 *
 * Fixed windows allow a 2x burst across a boundary. For the threat here — a
 * human or a script hammering a form — that is irrelevant, and a sliding
 * window is not worth the complexity.
 */

export class RateLimitError extends Error {
  constructor(public readonly retryAfterSeconds: number) {
    super("Too many requests");
    this.name = "RateLimitError";
  }
}

/** Hashed, so this table is never a log of visitor IP addresses. */
function bucket(route: string, identifier: string): string {
  const salt = process.env.AUTH_SECRET ?? "unsalted";
  const digest = createHash("sha256")
    .update(`${salt}:${identifier}`)
    .digest("base64url")
    .slice(0, 48);
  return `${route}:${digest}`;
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  // First hop is the client; the rest are proxies.
  return forwarded?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

export async function enforceRateLimit({
  route,
  identifier,
  limit,
  windowMs,
}: {
  route: string;
  identifier: string;
  limit: number;
  windowMs: number;
}): Promise<void> {
  const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs);
  const key = bucket(route, identifier);

  const rows = await prisma.$queryRaw<{ count: number }[]>`
    INSERT INTO rate_limit_hits ("id", "bucketKey", "windowStart", "count")
    VALUES (gen_random_uuid()::text, ${key}, ${windowStart}, 1)
    ON CONFLICT ("bucketKey", "windowStart")
      DO UPDATE SET "count" = rate_limit_hits."count" + 1
    RETURNING "count"
  `;

  const count = Number(rows[0]?.count ?? 0);

  // Opportunistic cleanup — no cron needed for a table this small.
  if (Math.random() < 0.02) {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await prisma.rateLimitHit
      .deleteMany({ where: { windowStart: { lt: cutoff } } })
      .catch(() => undefined);
  }

  if (count > limit) {
    const elapsed = Date.now() - windowStart.getTime();
    throw new RateLimitError(Math.ceil((windowMs - elapsed) / 1000));
  }
}

import "server-only";

import type { Prisma } from "@prisma/client";

/**
 * Human-readable order references: ORD-2026-0001.
 *
 * Allocated with a single INSERT … ON CONFLICT DO UPDATE … RETURNING against
 * the per-year counter row, which is atomic under concurrency. The two obvious
 * alternatives are both wrong here:
 *
 *   - `COUNT(*) + 1` races. Two simultaneous checkouts read the same count and
 *     the second one's insert fails on the unique index — or worse, succeeds
 *     against a different column set.
 *   - A Postgres SEQUENCE does not reset per year, and because sequence
 *     increments are non-transactional it leaks a gap on every rolled-back
 *     transaction. Customers read these numbers out over the phone; gaps and a
 *     five-digit counter in January are both avoidable.
 *
 * Must be called inside the order transaction so a rolled-back order does not
 * burn a number.
 */
export async function allocateOrderNumber(
  tx: Prisma.TransactionClient,
  prefix: string,
  now = new Date(),
): Promise<string> {
  const year = now.getUTCFullYear();

  const rows = await tx.$queryRaw<{ lastValue: number }[]>`
    INSERT INTO order_sequences ("year", "lastValue")
    VALUES (${year}, 1)
    ON CONFLICT ("year")
      DO UPDATE SET "lastValue" = order_sequences."lastValue" + 1
    RETURNING "lastValue"
  `;

  const value = Number(rows[0]?.lastValue ?? 0);
  if (!value) {
    throw new Error("Order number allocation returned no row");
  }

  // Padded to four digits but not truncated — order 10,000 renders as 10000
  // rather than wrapping round to 0000.
  return `${prefix}-${year}-${String(value).padStart(4, "0")}`;
}

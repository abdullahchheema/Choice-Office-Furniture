import { Prisma } from "@prisma/client";

/**
 * Money handling.
 *
 * Every monetary column is `Decimal(12,2)` and every sum is computed on
 * Decimal, never on a JS number. Two separate hazards are being avoided:
 *
 *   1. Float arithmetic. 0.1 + 0.2 is the classic example; on order totals it
 *      shows up as a rupee that appears or vanishes.
 *   2. The RSC boundary. `Prisma.Decimal` is a class instance, so passing a
 *      Prisma row straight to a client component throws "Only plain objects
 *      can be passed". The tempting fix — `Number(price)` — silently
 *      reintroduces hazard 1, so DTOs carry money as a STRING.
 */

export type DecimalLike = Prisma.Decimal | string | number;

export function toDecimal(value: DecimalLike): Prisma.Decimal {
  return value instanceof Prisma.Decimal
    ? value
    : new Prisma.Decimal(value.toString());
}

/** Serialisable form for anything crossing into a client component. */
export function toMoneyString(value: DecimalLike): string {
  return toDecimal(value).toFixed(2);
}

export function addMoney(...values: DecimalLike[]): Prisma.Decimal {
  return values.reduce<Prisma.Decimal>(
    (total, value) => total.plus(toDecimal(value)),
    new Prisma.Decimal(0),
  );
}

export function multiplyMoney(value: DecimalLike, quantity: number): Prisma.Decimal {
  if (!Number.isInteger(quantity) || quantity < 0) {
    throw new Error(`Quantity must be a non-negative integer, got ${quantity}`);
  }
  return toDecimal(value).times(quantity);
}

export function isGreaterThan(a: DecimalLike, b: DecimalLike): boolean {
  return toDecimal(a).greaterThan(toDecimal(b));
}

/**
 * Display format.
 *
 * PKR has no minor unit in retail use, so amounts show whole rupees even
 * though the column keeps two decimal places. The symbol comes from
 * WebsiteSetting rather than the locale, because it is admin-editable.
 */
export function formatMoney(value: DecimalLike, symbol = "Rs."): string {
  const amount = toDecimal(value);
  const rounded = amount.toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP);
  const grouped = new Intl.NumberFormat("en-US").format(Number(rounded));
  return `${symbol} ${grouped}`;
}

/** Percentage saved, for the discount badge. Null when there is no discount. */
export function discountPercent(
  price: DecimalLike,
  compareAtPrice: DecimalLike | null | undefined,
): number | null {
  if (compareAtPrice === null || compareAtPrice === undefined) return null;
  const now = toDecimal(price);
  const before = toDecimal(compareAtPrice);
  if (!before.greaterThan(now) || before.isZero()) return null;
  return Number(
    before.minus(now).dividedBy(before).times(100).toDecimalPlaces(0),
  );
}

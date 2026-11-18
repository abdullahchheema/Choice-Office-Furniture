"use server";

import { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { z } from "zod";

import { addMoney, multiplyMoney, toDecimal, toMoneyString } from "@/lib/money";
import { rememberOrder } from "@/lib/order-access";
import { allocateOrderNumber } from "@/lib/order-number";
import { normalisePhonePK } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/queries";
import { RateLimitError, clientIp, enforceRateLimit } from "@/lib/rate-limit";
import { renderOrderMessage, type WhatsappOrderLine } from "@/lib/whatsapp";

/**
 * Checkout.
 *
 * The one rule that shapes everything here: **the order is written to the
 * database before the customer is sent anywhere.** A WhatsApp handoff has no
 * callback and no payment event, so if the redirect is the only record of the
 * sale then every customer who doesn't have WhatsApp installed, or who closes
 * the tab, is simply lost. Writing first turns that case into a lead with a
 * phone number instead.
 *
 * The second rule: **nothing about money comes from the client.** The submitted
 * payload carries product ids and quantities. Prices, line totals, the shipping
 * fee and the order total are all read or computed server-side from the
 * database — there is no price field in the schema below to tamper with.
 */

export type CheckoutState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  /*
   * What the customer typed, echoed back.
   *
   * React 19 resets an uncontrolled form once its action resolves, so without
   * this a single mistyped digit in the phone number clears the name, the
   * address and the note as well. The form remounts its fields on `attempt`
   * and re-seeds them from here.
   */
  values?: Record<string, string>;
  attempt?: number;
};

const ECHOED = [
  "name",
  "phone",
  "email",
  "address",
  "city",
  "province",
  "postalCode",
  "note",
] as const;

function echo(formData: FormData): Record<string, string> {
  return Object.fromEntries(
    ECHOED.map((field) => [field, String(formData.get(field) ?? "")]),
  );
}

const LineSchema = z.object({
  id: z.string().min(1).max(64),
  // An upper bound matters: without it a quantity of 10^9 overflows the
  // Decimal(12,2) total and the insert fails with a database error instead of
  // a readable message.
  qty: z.number().int().min(1).max(99),
});

const CheckoutSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name").max(120),
  phone: z.string().trim().min(6, "Please enter your phone number").max(32),
  email: z.union([z.literal(""), z.string().trim().email("That email looks wrong")]),
  address: z.string().trim().min(8, "Please enter your full address").max(400),
  city: z.string().trim().min(2, "Please enter your city").max(80),
  province: z.string().trim().max(80),
  postalCode: z.string().trim().max(16),
  note: z.string().trim().max(1000),
  idempotencyKey: z.string().trim().min(8).max(64),
  items: z.array(LineSchema).min(1, "Your cart is empty").max(60),
});

export async function submitCheckout(
  previous: CheckoutState,
  formData: FormData,
): Promise<CheckoutState> {
  /* Every failure path echoes the submitted values back and bumps `attempt`,
     which is what makes the form remount its fields instead of clearing. */
  const fail = (state: CheckoutState): CheckoutState => ({
    ...state,
    values: echo(formData),
    attempt: (previous.attempt ?? 0) + 1,
  });

  /* ---------------------------------------------------------------- 1. parse */

  let rawItems: unknown;
  try {
    rawItems = JSON.parse(String(formData.get("items") ?? "[]"));
  } catch {
    return fail({ error: "Your cart could not be read. Please reload and try again." });
  }

  const parsed = CheckoutSchema.safeParse({
    name: formData.get("name") ?? "",
    phone: formData.get("phone") ?? "",
    email: formData.get("email") ?? "",
    address: formData.get("address") ?? "",
    city: formData.get("city") ?? "",
    province: formData.get("province") ?? "",
    postalCode: formData.get("postalCode") ?? "",
    note: formData.get("note") ?? "",
    idempotencyKey: formData.get("idempotencyKey") ?? "",
    items: rawItems,
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0] ?? "form");
      fieldErrors[field] ??= issue.message;
    }
    return fail({
      error: fieldErrors.items ?? "Please check the highlighted fields.",
      fieldErrors,
    });
  }

  const input = parsed.data;

  const phoneE164 = normalisePhonePK(input.phone);
  if (!phoneE164) {
    return fail({
      error: "Please check the highlighted fields.",
      fieldErrors: {
        phone: "Enter a Pakistani mobile number, e.g. 0300 1234567",
      },
    });
  }

  /* ------------------------------------------- 2. idempotency, before any work */

  /*
   * The fast path. A double-click, Enter pressed twice, a retried POST and a
   * second tab all submit the same key, so they all land on the original
   * order instead of creating a second one. Disabling the submit button is
   * also done in the form, but it does nothing for a request the browser
   * retries on its own.
   */
  const existing = await prisma.order.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
    select: { orderNumber: true },
  });
  if (existing) redirect(`/orders/${existing.orderNumber}`);

  /* ----------------------------------------------------------- 3. rate limits */

  try {
    await enforceRateLimit({
      route: "checkout-ip",
      identifier: await clientIp(),
      limit: 20,
      windowMs: 60 * 60 * 1000,
    });
    /*
     * The per-phone bucket is the one that actually stops abuse. IP addresses
     * are cheap — a mobile network rotates them and a VPN sells them — but a
     * spammer flooding orders under one number is the realistic case, and it
     * is the shop owner's phone that suffers.
     */
    await enforceRateLimit({
      route: "checkout-phone",
      identifier: phoneE164,
      limit: 6,
      windowMs: 60 * 60 * 1000,
    });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return fail({
        error:
          "That's a lot of orders in a short time. Please wait a few minutes, or call us instead.",
      });
    }
    throw error;
  }

  /* ------------------------------------------------- 4. re-price from the database */

  const settings = await getSettings();

  const ids = [...new Set(input.items.map((item) => item.id))];
  const products = await prisma.product.findMany({
    where: { id: { in: ids }, status: "PUBLISHED" },
    select: {
      id: true,
      name: true,
      sku: true,
      slug: true,
      price: true,
      stockQuantity: true,
      trackInventory: true,
      category: { select: { name: true } },
      images: {
        where: { isPrimary: true },
        select: { storagePath: true },
        take: 1,
      },
    },
  });

  const byId = new Map(products.map((product) => [product.id, product]));

  // A product unpublished or deleted between loading the cart and submitting
  // it is a real, ordinary case — say which one, rather than failing opaquely.
  const missing = input.items.filter((item) => !byId.has(item.id));
  if (missing.length > 0) {
    return fail({
      error:
        missing.length === input.items.length
          ? "Nothing in your cart is available any more. Please start again."
          : `${missing.length} item${missing.length === 1 ? "" : "s"} in your cart ${
              missing.length === 1 ? "is" : "are"
            } no longer available. Please remove ${
              missing.length === 1 ? "it" : "them"
            } and try again.`,
    });
  }

  const shortfalls: string[] = [];
  const lines = input.items.map((item) => {
    const product = byId.get(item.id)!;

    if (product.trackInventory && product.stockQuantity < item.qty) {
      shortfalls.push(
        product.stockQuantity === 0
          ? `${product.name} is out of stock`
          : `only ${product.stockQuantity} × ${product.name} left`,
      );
    }

    // The price comes from this row, never from the request.
    const unitPrice = toDecimal(product.price);
    return {
      product,
      quantity: item.qty,
      unitPrice,
      lineTotal: multiplyMoney(unitPrice, item.qty),
    };
  });

  if (shortfalls.length > 0) {
    return fail({
      error: `We can't fill that quantity — ${shortfalls.join("; ")}. Please adjust your cart.`,
    });
  }

  const subtotal = addMoney(...lines.map((line) => line.lineTotal));

  const threshold = settings.freeShippingThreshold;
  const shippingFee =
    threshold && !subtotal.lessThan(toDecimal(threshold))
      ? toDecimal(0)
      : toDecimal(settings.shippingFee);

  const total = subtotal.plus(shippingFee);
  const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0);

  /* ------------------------------------------------------- 5. write, in one go */

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");

  let orderNumber: string;
  try {
    orderNumber = await prisma.$transaction(async (tx) => {
      // Inside the transaction, so a rolled-back order does not burn a number.
      const number = await allocateOrderNumber(tx, settings.orderNumberPrefix);

      const customer = await tx.customer.upsert({
        where: { phoneE164 },
        create: {
          phoneE164,
          phoneRaw: input.phone,
          name: input.name,
          email: input.email || null,
          addressLine: input.address,
          city: input.city,
          province: input.province || null,
          postalCode: input.postalCode || null,
          orderCount: 1,
          lastOrderAt: new Date(),
        },
        update: {
          // The latest details win: a customer who has moved expects the new
          // address to stick. The order's own snapshot preserves what this
          // particular delivery was addressed to.
          name: input.name,
          phoneRaw: input.phone,
          email: input.email || undefined,
          addressLine: input.address,
          city: input.city,
          province: input.province || undefined,
          postalCode: input.postalCode || undefined,
          orderCount: { increment: 1 },
          lastOrderAt: new Date(),
        },
        select: { id: true },
      });

      const messageLines: WhatsappOrderLine[] = lines.map((line) => ({
        productName: line.product.name,
        productSku: line.product.sku,
        quantity: line.quantity,
        unitPrice: toMoneyString(line.unitPrice),
        lineTotal: toMoneyString(line.lineTotal),
      }));

      const whatsappMessage = renderOrderMessage({
        orderNumber: number,
        brandName: settings.brandName,
        customerName: input.name,
        customerPhone: input.phone,
        shippingAddress: input.address,
        shippingCity: input.city,
        customerNote: input.note || null,
        currencySymbol: settings.currencySymbol,
        lines: messageLines,
        subtotal: toMoneyString(subtotal),
        shippingFee: toMoneyString(shippingFee),
        total: toMoneyString(total),
        itemCount,
        siteUrl,
      });

      await tx.order.create({
        data: {
          orderNumber: number,
          idempotencyKey: input.idempotencyKey,
          status: "PENDING_CONFIRMATION",
          customerId: customer.id,

          customerName: input.name,
          customerPhone: input.phone,
          customerPhoneE164: phoneE164,
          customerEmail: input.email || null,
          shippingAddress: input.address,
          shippingCity: input.city,
          shippingProvince: input.province || null,
          shippingPostalCode: input.postalCode || null,
          customerNote: input.note || null,

          currency: settings.currencyCode,
          subtotal,
          shippingFee,
          total,
          itemCount,
          whatsappMessage,

          /*
           * Note what is NOT here: no stock movement. A WhatsApp enquiry is not
           * a commitment — there is no payment to release a reservation
           * against, so decrementing now would let abandoned submissions mark
           * sellable chairs out of stock with nothing to undo it. Stock moves
           * when a human confirms the order (lib/services/order-status.ts).
           */
          items: {
            create: lines.map((line) => ({
              productId: line.product.id,
              productName: line.product.name,
              productSku: line.product.sku,
              productSlug: line.product.slug,
              categoryName: line.product.category.name,
              unitPrice: line.unitPrice,
              quantity: line.quantity,
              lineTotal: line.lineTotal,
              imagePath: line.product.images[0]?.storagePath ?? null,
            })),
          },

          history: {
            create: {
              fromStatus: null,
              toStatus: "PENDING_CONFIRMATION",
              changedByLabel: "customer",
              note: "Order placed from the website",
            },
          },
        },
      });

      return number;
    });
  } catch (error) {
    /*
     * P2002 on the idempotency key means a concurrent duplicate won the race
     * — the fast-path read above happened before the other request's commit.
     * The outcome the customer wants is the same either way: their order.
     */
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const duplicate = await prisma.order.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
        select: { orderNumber: true },
      });
      if (duplicate) redirect(`/orders/${duplicate.orderNumber}`);
    }

    console.error("[checkout] order creation failed", error);
    return fail({
      error:
        "We couldn't record your order. Nothing has been submitted — please try again.",
    });
  }

  /*
   * Lets the confirmation page show this customer their own details. Order
   * references are guessable by design, so without this the page would be an
   * enumerable leak of every customer's name, phone and address — see
   * lib/order-access.ts.
   */
  await rememberOrder(orderNumber);

  // Outside the try: redirect() signals by throwing, and catching it here would
  // turn a successful checkout into the error message above.
  redirect(`/orders/${orderNumber}`);
}

/**
 * Stamped when the customer actually opens WhatsApp.
 *
 * This is what separates "pending, contacted us" from "pending, never opened
 * WhatsApp" in the admin queue — the second group is a call list, not a
 * failure. Deliberately unauthenticated and deliberately harmless: the only
 * thing it can do is set a timestamp on an order whose number you already know.
 */
export async function markWhatsappOpened(orderNumber: string): Promise<void> {
  await prisma.order
    .updateMany({
      where: { orderNumber, whatsappOpenedAt: null },
      data: { whatsappOpenedAt: new Date() },
    })
    .catch(() => undefined);
}

"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { useCart } from "@/components/providers/CartProvider";
import { submitCheckout, type CheckoutState } from "@/lib/actions/checkout";

/**
 * The checkout form.
 *
 * What it submits is deliberately thin: contact and address fields, the cart as
 * `[{id, qty}]`, and the idempotency key. No prices and no total — the server
 * re-reads every price from the database and recomputes the total itself, so
 * there is nothing here worth tampering with.
 */
export function CheckoutForm({
  shippingFee,
  freeShippingThreshold,
}: {
  shippingFee: string;
  freeShippingThreshold: string | null;
}) {
  const { items, lines, count, subtotalValue, currencySymbol, idempotencyKey, hydrated } =
    useCart();
  const [state, formAction] = useActionState<CheckoutState, FormData>(
    submitCheckout,
    {},
  );

  if (!hydrated) {
    return <div className="panel" style={{ minHeight: 320 }} aria-busy="true" />;
  }

  if (items.length === 0) {
    return (
      <div className="empty-state">
        <h2>There&apos;s nothing to check out</h2>
        <p>Add something to your cart and we&apos;ll take it from here.</p>
        <Link className="btn btn--primary" href="/shop">
          Browse the catalogue
        </Link>
      </div>
    );
  }

  const threshold = freeShippingThreshold ? Number(freeShippingThreshold) : null;
  const shipping =
    threshold !== null && subtotalValue >= threshold ? 0 : Number(shippingFee);
  const money = (value: number) =>
    `${currencySymbol} ${new Intl.NumberFormat("en-US").format(Math.round(value))}`;

  const errors = state.fieldErrors ?? {};
  const values = state.values ?? {};
  /*
   * React 19 resets an uncontrolled form once its action resolves, so after a
   * validation error every field would come back blank. Keying the fields on
   * the attempt number remounts them, which re-applies the defaultValues the
   * server echoed back — the customer fixes the one wrong field instead of
   * retyping their address.
   */
  const attempt = state.attempt ?? 0;

  return (
    <form action={formAction} className="commerce-layout" key={attempt}>
      {/* The cart, as ids and quantities. The server prices it. */}
      <input type="hidden" name="items" value={JSON.stringify(lines)} />
      {/* Minted when the cart first became non-empty, so every retry of this
          submission carries the same key and resolves to one order. */}
      <input type="hidden" name="idempotencyKey" value={idempotencyKey ?? ""} />

      <div>
        <div className="panel">
          <h2>Contact</h2>
          <p className="hint">We confirm every order by phone or WhatsApp.</p>

          <div className="field-grid field-grid--2" style={{ marginTop: 20 }}>
            <Field
              label="Full name"
              name="name"
              defaultValue={values.name}
              autoComplete="name"
              required
              error={errors.name}
            />
            <Field
              label="Mobile number"
              name="phone"
              defaultValue={values.phone}
              type="tel"
              autoComplete="tel"
              required
              placeholder="0300 1234567"
              help="A WhatsApp-capable mobile number"
              error={errors.phone}
            />
            <Field
              label="Email (optional)"
              name="email"
              defaultValue={values.email}
              type="email"
              autoComplete="email"
              className="span-2"
              error={errors.email}
            />
          </div>
        </div>

        <div className="panel">
          <h2>Delivery address</h2>
          <p className="hint">Street, building and floor — whatever helps us find you.</p>

          <div className="field-grid field-grid--2" style={{ marginTop: 20 }}>
            <Field
              label="Address"
              name="address"
              defaultValue={values.address}
              autoComplete="street-address"
              textarea
              required
              className="span-2"
              error={errors.address}
            />
            <Field
              label="City"
              name="city"
              defaultValue={values.city}
              autoComplete="address-level2"
              required
              error={errors.city}
            />
            <Field
              label="Province (optional)"
              name="province"
              defaultValue={values.province}
              autoComplete="address-level1"
              error={errors.province}
            />
            <Field
              label="Postal code (optional)"
              name="postalCode"
              defaultValue={values.postalCode}
              autoComplete="postal-code"
              error={errors.postalCode}
            />
          </div>
        </div>

        <div className="panel">
          <h2>Anything else?</h2>
          <div className="form-field" style={{ marginTop: 16 }}>
            <label htmlFor="note">Note for our team (optional)</label>
            <textarea
              id="note"
              name="note"
              defaultValue={values.note}
              maxLength={1000}
              placeholder="Delivery timing, floor, assembly, a question about finish…"
            />
          </div>
        </div>
      </div>

      <aside className="panel summary">
        <h2>
          {count} item{count === 1 ? "" : "s"}
        </h2>

        <ul className="line-list" style={{ marginTop: 14 }}>
          {items.map(({ product, qty }) => (
            <li
              key={product.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 14,
                padding: "9px 0",
                fontSize: "0.88rem",
              }}
            >
              <span>
                {qty} × {product.name}
              </span>
              <strong style={{ whiteSpace: "nowrap" }}>
                {money(Number(product.priceValue) * qty)}
              </strong>
            </li>
          ))}
        </ul>

        <ul className="totals" style={{ marginTop: 18 }}>
          <li>
            <span>Subtotal</span>
            <strong>{money(subtotalValue)}</strong>
          </li>
          <li>
            <span>Delivery</span>
            <strong>{shipping === 0 ? "Free" : money(shipping)}</strong>
          </li>
          <li className="grand">
            <span>Total</span>
            <strong>{money(subtotalValue + shipping)}</strong>
          </li>
        </ul>

        {state.error ? (
          <p className="form-error" role="alert" style={{ marginTop: 18 }}>
            {state.error}
          </p>
        ) : null}

        <Submit />

        <p className="hint" style={{ marginTop: 14, textAlign: "center" }}>
          Your order is saved before WhatsApp opens, so nothing is lost if the chat
          doesn&apos;t start.
        </p>
      </aside>
    </form>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      /* Stops the ordinary double-click. It does nothing for a request the
         browser itself retries — that is what the idempotency key is for. */
      disabled={pending}
      className="btn btn--primary btn--block"
      style={{ marginTop: 22 }}
    >
      {pending ? "Placing your order…" : "Place order"}
    </button>
  );
}

function Field({
  label,
  name,
  defaultValue,
  type = "text",
  autoComplete,
  placeholder,
  help,
  error,
  required,
  textarea,
  className,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  type?: string;
  autoComplete?: string;
  placeholder?: string;
  help?: string;
  error?: string;
  required?: boolean;
  textarea?: boolean;
  className?: string;
}) {
  const describedBy = [error ? `${name}-error` : null, help ? `${name}-help` : null]
    .filter(Boolean)
    .join(" ");

  const shared = {
    id: name,
    name,
    defaultValue,
    autoComplete,
    placeholder,
    required,
    "aria-invalid": error ? (true as const) : undefined,
    "aria-describedby": describedBy || undefined,
  };

  return (
    <div className={`form-field${className ? ` ${className}` : ""}`}>
      <label htmlFor={name}>{label}</label>
      {textarea ? (
        <textarea {...shared} rows={3} />
      ) : (
        <input {...shared} type={type} />
      )}
      {help ? (
        <p className="help" id={`${name}-help`}>
          {help}
        </p>
      ) : null}
      {error ? (
        <p className="error" id={`${name}-error`}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

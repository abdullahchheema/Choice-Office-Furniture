"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { updateSettings, type SettingsState } from "@/lib/actions/settings";

const FIELD =
  "w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-espresso outline-none placeholder:text-text-muted/60 focus-visible:border-clay focus-visible:ring-2 focus-visible:ring-clay/25";
const LABEL =
  "mb-1.5 block text-xs font-bold uppercase tracking-[0.12em] text-text-muted";

export type SettingsValues = Record<string, string>;

export function SettingsForm({ values }: { values: SettingsValues }) {
  const [state, formAction] = useActionState<SettingsState, FormData>(
    updateSettings,
    {},
  );
  const err = (field: string) => state.fieldErrors?.[field];

  return (
    <form action={formAction} className="space-y-6">
      {state.saved ? (
        <p
          role="status"
          className="rounded-md border border-oak bg-sand/40 px-4 py-3 text-sm font-semibold text-espresso"
        >
          Settings saved. The storefront picks them up immediately.
        </p>
      ) : null}

      <Section title="Business">
        <Field label="Business name" error={err("brandName")}>
          <input name="brandName" defaultValue={values.brandName} className={FIELD} />
        </Field>
        <Field label="Tagline" error={err("tagline")}>
          <input name="tagline" defaultValue={values.tagline} className={FIELD} />
        </Field>
      </Section>

      <Section
        title="Orders"
        note="Every checkout is sent to this WhatsApp number. Changing it here takes effect on the next order — nothing is hardcoded."
      >
        <Field
          label="WhatsApp number"
          hint="Mobile only, e.g. 0300 1234567"
          error={err("whatsapp")}
        >
          <input name="whatsapp" defaultValue={values.whatsapp} className={FIELD} />
        </Field>
        <Field label="Phone" error={err("phone")}>
          <input name="phone" defaultValue={values.phone} className={FIELD} />
        </Field>
        <Field label="Email" error={err("email")}>
          <input name="email" type="email" defaultValue={values.email} className={FIELD} />
        </Field>
        <Field label="Currency symbol" error={err("currencySymbol")}>
          <input
            name="currencySymbol"
            defaultValue={values.currencySymbol}
            className={FIELD}
          />
        </Field>
        <Field label="Delivery fee" hint="0 for free delivery" error={err("shippingFee")}>
          <input
            name="shippingFee"
            inputMode="decimal"
            defaultValue={values.shippingFee}
            className={FIELD}
          />
        </Field>
        <Field label="Delivery note" error={err("shippingNote")}>
          <input
            name="shippingNote"
            defaultValue={values.shippingNote}
            className={FIELD}
          />
        </Field>
      </Section>

      <Section title="Showroom">
        <Field label="Address" error={err("addressLine")}>
          <input name="addressLine" defaultValue={values.addressLine} className={FIELD} />
        </Field>
        <Field label="City" error={err("city")}>
          <input name="city" defaultValue={values.city} className={FIELD} />
        </Field>
        <Field label="Opening hours" error={err("openingHours")}>
          <input
            name="openingHours"
            defaultValue={values.openingHours}
            className={FIELD}
          />
        </Field>
      </Section>

      <Section title="Social">
        <Field label="Facebook" error={err("facebookUrl")}>
          <input name="facebookUrl" defaultValue={values.facebookUrl} className={FIELD} />
        </Field>
        <Field label="Instagram" error={err("instagramUrl")}>
          <input
            name="instagramUrl"
            defaultValue={values.instagramUrl}
            className={FIELD}
          />
        </Field>
        <Field label="LinkedIn" error={err("linkedinUrl")}>
          <input name="linkedinUrl" defaultValue={values.linkedinUrl} className={FIELD} />
        </Field>
      </Section>

      <Section title="Policies" note="Shown on the storefront's policy pages.">
        <Field label="Delivery policy" className="sm:col-span-2">
          <textarea
            name="deliveryPolicy"
            rows={3}
            defaultValue={values.deliveryPolicy}
            className={FIELD}
          />
        </Field>
        <Field label="Return policy" className="sm:col-span-2">
          <textarea
            name="returnPolicy"
            rows={3}
            defaultValue={values.returnPolicy}
            className={FIELD}
          />
        </Field>
        <Field label="Privacy policy" className="sm:col-span-2">
          <textarea
            name="privacyPolicy"
            rows={4}
            defaultValue={values.privacyPolicy}
            className={FIELD}
          />
        </Field>
        <Field label="Terms and conditions" className="sm:col-span-2">
          <textarea
            name="termsPolicy"
            rows={4}
            defaultValue={values.termsPolicy}
            className={FIELD}
          />
        </Field>
      </Section>

      <Submit />
    </form>
  );
}

function Section({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-card border border-line bg-white p-6">
      <h2 className="font-display text-lg font-extrabold text-ink">{title}</h2>
      {note ? <p className="mt-1 max-w-prose text-xs text-text-muted">{note}</p> : null}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function Field({
  label,
  hint,
  error,
  className = "",
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label className={LABEL}>{label}</label>
      {children}
      {error ? (
        <p className="mt-1 text-xs font-semibold text-destructive">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <div className="sticky bottom-4 flex justify-end">
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-espresso px-7 py-3 text-sm font-bold text-cream shadow-[0_14px_30px_-14px_rgba(59,42,30,0.55)] transition-colors hover:bg-walnut disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save settings"}
      </button>
    </div>
  );
}

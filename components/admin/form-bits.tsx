"use client";

import { useFormStatus } from "react-dom";

/** Shared look for the admin forms, so every editor reads as one surface. */
export const FIELD =
  "w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-espresso outline-none placeholder:text-text-muted/60 focus-visible:border-clay focus-visible:ring-2 focus-visible:ring-clay/25";
export const LABEL =
  "mb-1.5 block text-xs font-bold uppercase tracking-[0.12em] text-text-muted";
export const BTN =
  "rounded-full border border-espresso px-4 py-2 text-sm font-bold text-espresso transition-colors hover:bg-espresso hover:text-cream disabled:opacity-50";
export const BTN_PRIMARY =
  "rounded-full bg-espresso px-5 py-2.5 text-sm font-bold text-cream transition-colors hover:bg-walnut disabled:opacity-60";

export function Section({
  title,
  note,
  children,
  id,
}: {
  title: string;
  note?: React.ReactNode;
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <section id={id} className="scroll-mt-24 rounded-card border border-line bg-white p-6">
      <h2 className="font-display text-lg font-extrabold text-ink">{title}</h2>
      {note ? <p className="mt-1 max-w-prose text-xs text-text-muted">{note}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function Field({
  label,
  hint,
  error,
  className = "",
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  className?: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className={LABEL}>
        {label}
      </label>
      {children}
      {/* Errors sit next to their field, not collected at the top of the form. */}
      {error ? (
        <p className="mt-1 text-xs font-semibold text-destructive">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export function Toggle({
  name,
  label,
  defaultChecked,
}: {
  name: string;
  label: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="flex items-center gap-2.5 py-2 text-sm font-semibold text-espresso">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="h-4 w-4 accent-[var(--color-espresso)]"
      />
      {label}
    </label>
  );
}

/** Success / error line for the small save-in-place forms. */
export function Notice({ error, message }: { error?: string; message?: string }) {
  if (error) {
    return (
      <p role="alert" className="text-sm font-semibold text-destructive">
        {error}
      </p>
    );
  }
  if (message) {
    return (
      <p role="status" className="text-sm font-semibold text-espresso">
        {message}
      </p>
    );
  }
  return null;
}

export function SubmitButton({
  children,
  pendingLabel = "Saving…",
  className = BTN_PRIMARY,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? pendingLabel : children}
    </button>
  );
}

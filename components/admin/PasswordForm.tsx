"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { changePassword, type ProfileState } from "@/lib/actions/profile";

const FIELD =
  "w-full rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus-visible:border-clay";

export function PasswordForm() {
  const [state, formAction] = useActionState<ProfileState, FormData>(
    changePassword,
    {},
  );

  return (
    <form action={formAction} className="mt-4 max-w-sm space-y-4">
      <Field label="Current password" name="current" autoComplete="current-password" />
      <Field
        label="New password"
        name="next"
        autoComplete="new-password"
        hint="At least 12 characters"
      />
      <Field label="Confirm new password" name="confirm" autoComplete="new-password" />

      {state.error ? (
        <p role="alert" className="text-sm font-semibold text-destructive">
          {state.error}
        </p>
      ) : null}
      {state.message ? (
        <p
          role="status"
          className="rounded-md border border-oak bg-sand/40 px-3 py-2 text-sm font-semibold text-espresso"
        >
          {state.message}{" "}
          <a className="underline" href="/admin/login">
            Sign in again
          </a>
        </p>
      ) : null}

      <Submit />
    </form>
  );
}

function Field({
  label,
  name,
  autoComplete,
  hint,
}: {
  label: string;
  name: string;
  autoComplete: string;
  hint?: string;
}) {
  return (
    <div>
      <label
        htmlFor={name}
        className="mb-1.5 block text-xs font-bold uppercase tracking-[0.12em] text-text-muted"
      >
        {label}
      </label>
      <input
        id={name}
        name={name}
        type="password"
        autoComplete={autoComplete}
        required
        className={FIELD}
      />
      {hint ? <p className="mt-1 text-xs text-text-muted">{hint}</p> : null}
    </div>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-full bg-espresso px-6 py-2.5 text-sm font-bold text-cream hover:bg-walnut disabled:opacity-60"
    >
      {pending ? "Changing…" : "Change password"}
    </button>
  );
}

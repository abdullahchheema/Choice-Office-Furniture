"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { login, type LoginState } from "@/lib/actions/auth";

const FIELD =
  "w-full rounded-md border border-line bg-cream px-3 py-2.5 text-sm text-espresso outline-none placeholder:text-text-muted/70 focus-visible:border-clay focus-visible:ring-2 focus-visible:ring-clay/30";

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction] = useActionState<LoginState, FormData>(login, {});

  return (
    <form action={formAction} className="mt-6 space-y-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}

      <div>
        <label
          htmlFor="email"
          className="mb-1.5 block text-xs font-bold uppercase tracking-[0.14em] text-text-muted"
        >
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          autoFocus
          className={FIELD}
          placeholder="owner@choiceofficefurniture.pk"
        />
      </div>

      <div>
        <label
          htmlFor="password"
          className="mb-1.5 block text-xs font-bold uppercase tracking-[0.14em] text-text-muted"
        >
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={FIELD}
        />
      </div>

      {/* The message is intentionally the same for a missing account and a
          wrong password — anything more specific enumerates valid emails. */}
      {state.error ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          {state.error}
        </p>
      ) : null}

      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-2 w-full rounded-full bg-espresso px-6 py-3 text-sm font-bold text-cream transition-colors hover:bg-walnut disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Signing in…" : "Sign in"}
    </button>
  );
}

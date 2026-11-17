"use client";

import { useId, useState } from "react";

/**
 * Client-side validation only — nothing is sent anywhere yet.
 *
 * The pattern is the original's, kept deliberately: this is a UX hint, and in
 * Phase 5 the form becomes a Server Action where Zod does the validation that
 * actually matters. Duplicating a stricter rule here would only risk the two
 * disagreeing about what counts as valid.
 */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function NewsletterForm() {
  const inputId = useId();
  const messageId = useId();
  const [value, setValue] = useState("");
  const [message, setMessage] = useState("");
  const [invalid, setInvalid] = useState(false);

  return (
    <form
      className="signup"
      noValidate
      data-reveal
      style={{ "--d": "120ms" } as React.CSSProperties}
      onSubmit={(event) => {
        event.preventDefault();
        const trimmed = value.trim();
        if (!EMAIL.test(trimmed)) {
          setInvalid(true);
          setMessage("Please enter a valid email address, like name@example.com.");
          return;
        }
        setInvalid(false);
        setMessage("Thank you — welcome to Choice! Check your inbox for 10% off.");
        setValue("");
      }}
    >
      <h3>Join the Choice letter</h3>
      <p>New arrivals, care tips and 10% off your first order.</p>

      <label htmlFor={inputId} className="sr-only">
        Email address
      </label>
      <div className="field">
        <input
          id={inputId}
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@example.com"
          aria-describedby={messageId}
          aria-invalid={invalid || undefined}
          required
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            // Clear the error as soon as they start correcting it.
            if (invalid) {
              setInvalid(false);
              setMessage("");
            }
          }}
        />
        <button className="btn btn--light" type="submit">
          Subscribe
        </button>
      </div>

      <p
        className={`form-msg${invalid ? " error" : ""}`}
        id={messageId}
        role="status"
        aria-live="polite"
      >
        {message}
      </p>
    </form>
  );
}

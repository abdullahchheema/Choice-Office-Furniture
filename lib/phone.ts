/**
 * Pakistani mobile numbers, normalised to E.164.
 *
 * This is both the customer dedupe key and the WhatsApp dial string, so it has
 * to be one canonical form. Input is accepted generously — 0300 1234567,
 * +92 300 1234567, 0092…, with spaces, dashes or brackets — and only the
 * result is strict.
 *
 * Landlines are rejected on purpose: WhatsApp cannot reach them, so accepting
 * one would create an order nobody can confirm.
 */
export function normalisePhonePK(input: string): string | null {
  const cleaned = input.replace(/[^\d+]/g, "");
  let digits = cleaned.startsWith("+") ? cleaned.slice(1) : cleaned;

  if (digits.startsWith("0092")) digits = digits.slice(4);
  else if (digits.startsWith("92")) digits = digits.slice(2);
  else if (digits.startsWith("0")) digits = digits.slice(1);

  // Pakistani mobiles are 3XX XXXXXXX once the country code is stripped.
  if (!/^3\d{9}$/.test(digits)) return null;

  return `+92${digits}`;
}

/** 0300 1234567 — how the number is shown back to staff. */
export function formatPhonePK(e164: string): string {
  const match = /^\+92(3\d{2})(\d{7})$/.exec(e164);
  if (!match) return e164;
  return `0${match[1]} ${match[2]}`;
}

/** wa.me wants the number without a leading +. */
export function whatsappDialNumber(e164: string): string {
  return e164.replace(/^\+/, "");
}

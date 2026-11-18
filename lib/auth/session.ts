import { SignJWT, jwtVerify } from "jose";

/*
 * Admin sessions.
 *
 * Deliberately not Auth.js: `next-auth@latest` is still v4, v5 has been in
 * beta for a very long time, and its credentials provider forces JWT sessions
 * anyway. More decisively, Next middleware runs on the Edge runtime where
 * Prisma and native hashing cannot run, so any design splits into a stateless
 * cryptographic check (here, Edge-safe) and a stateful database check
 * (lib/auth/guard.ts, Node). Building on that split directly is simpler than
 * bending a framework around it.
 *
 * This module is Edge-safe on purpose — no "server-only", no Node APIs — so
 * middleware can import it. It must never gain a Prisma import.
 */

export const SESSION_COOKIE = "cof_admin_session";
const ISSUER = "choice-office-furniture";
const MAX_AGE_SECONDS = 8 * 60 * 60; // 8 hours

export type SessionClaims = {
  sub: string;
  email: string;
  name: string;
  /** Mirrors AdminUser.sessionEpoch; a mismatch revokes the token. */
  epoch: number;
};

function secret(): Uint8Array {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 32) {
    throw new Error(
      "AUTH_SECRET is missing or too short (needs 32+ characters). " +
        'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64url\'))"',
    );
  }
  return new TextEncoder().encode(value);
}

export async function createSessionToken(claims: SessionClaims): Promise<string> {
  return new SignJWT({ ...claims })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(ISSUER)
    .setAudience(ISSUER)
    .setSubject(claims.sub)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .setJti(crypto.randomUUID())
    .sign(secret());
}

/** Verifies signature, issuer, audience and expiry. Returns null on any failure. */
export async function readSessionToken(
  token: string | undefined,
): Promise<SessionClaims | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), {
      issuer: ISSUER,
      audience: ISSUER,
    });
    if (
      typeof payload.sub !== "string" ||
      typeof payload.email !== "string" ||
      typeof payload.name !== "string" ||
      typeof payload.epoch !== "number"
    ) {
      return null;
    }
    return {
      sub: payload.sub,
      email: payload.email,
      name: payload.name,
      epoch: payload.epoch,
    };
  } catch {
    return null;
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  // Lax blocks the cookie on cross-site POSTs, which is the first of three
  // CSRF layers; Next's own Server Action origin check is the second.
  sameSite: "lax" as const,
  path: "/",
  maxAge: MAX_AGE_SECONDS,
};

export const SESSION_MAX_AGE_SECONDS = MAX_AGE_SECONDS;

"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { equalisePasswordTiming, verifyPassword } from "@/lib/auth/password";
import {
  SESSION_COOKIE,
  createSessionToken,
  sessionCookieOptions,
} from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { RateLimitError, clientIp, enforceRateLimit } from "@/lib/rate-limit";

export type LoginState = { error?: string };

const LoginSchema = z.object({
  email: z.string().trim().min(1, "Enter your email").max(200),
  // bcrypt-style 72-byte truncation does not apply to argon2, but a cap keeps
  // an attacker from sending megabytes to burn CPU in the hash.
  password: z.string().min(1, "Enter your password").max(200),
  next: z.string().optional(),
});

const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_MINUTES = 15;

export async function login(
  _previous: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = LoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") ?? undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check your details" };
  }

  const { email, password } = parsed.data;
  const normalisedEmail = email.toLowerCase();

  // Two buckets: by IP, and by the account being targeted. The second is what
  // actually stops a distributed guessing attempt on one known admin address.
  try {
    const ip = await clientIp();
    await enforceRateLimit({
      route: "admin-login-ip",
      identifier: ip,
      limit: 10,
      windowMs: 15 * 60 * 1000,
    });
    await enforceRateLimit({
      route: "admin-login-account",
      identifier: normalisedEmail,
      limit: 10,
      windowMs: 15 * 60 * 1000,
    });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return {
        error: `Too many attempts. Try again in ${Math.ceil(
          error.retryAfterSeconds / 60,
        )} minutes.`,
      };
    }
    throw error;
  }

  const user = await prisma.adminUser.findUnique({
    where: { email: normalisedEmail },
  });

  /*
   * One generic message for every failure, and the same work done either way.
   * Returning faster for "no such account" than for "wrong password" is an
   * account-enumeration oracle, so a missing user still pays for a hash.
   */
  const GENERIC = "Email or password is incorrect";

  if (!user) {
    await equalisePasswordTiming(password);
    return { error: GENERIC };
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const minutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
    return { error: `Account locked. Try again in ${minutes} minutes.` };
  }

  if (!user.isActive) {
    await equalisePasswordTiming(password);
    return { error: GENERIC };
  }

  const ok = await verifyPassword(user.passwordHash, password);

  if (!ok) {
    const failures = user.failedLogins + 1;
    await prisma.adminUser.update({
      where: { id: user.id },
      data: {
        failedLogins: failures,
        lockedUntil:
          failures >= LOCKOUT_THRESHOLD
            ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000)
            : null,
      },
    });
    return { error: GENERIC };
  }

  await prisma.adminUser.update({
    where: { id: user.id },
    data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() },
  });

  const token = await createSessionToken({
    sub: user.id,
    email: user.email,
    name: user.name,
    epoch: user.sessionEpoch,
  });

  (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions);

  const target =
    parsed.data.next && parsed.data.next.startsWith("/admin")
      ? parsed.data.next // only ever an internal admin path — never an open redirect
      : "/admin";

  redirect(target);
}

export async function logout(): Promise<void> {
  /*
   * Clears this device only. The session epoch is deliberately NOT bumped —
   * that would sign the admin out everywhere, which belongs behind an explicit
   * "sign out everywhere" action, not the ordinary logout button.
   */
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/admin/login");
}

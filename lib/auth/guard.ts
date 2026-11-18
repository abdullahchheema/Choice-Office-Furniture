import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { SESSION_COOKIE, readSessionToken } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export type AdminIdentity = {
  id: string;
  name: string;
  email: string;
};

/**
 * The real authorization boundary.
 *
 * Middleware only redirects — it runs on the Edge, cannot reach Prisma, and so
 * can prove nothing beyond "this token is well-formed and unexpired". This
 * function re-reads the account on every call, which is what catches an admin
 * who has been deactivated or whose sessions were revoked mid-session.
 *
 * It must be called at the top of the admin layout AND at the top of every
 * admin Server Action and route handler. A Server Action is an independent
 * HTTP entry point: it is NOT protected by the layout of the page that
 * rendered its form.
 */
export async function requireAdmin(): Promise<AdminIdentity> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const claims = await readSessionToken(token);

  if (!claims) redirect("/admin/login");

  const user = await prisma.adminUser.findUnique({
    where: { id: claims.sub },
    select: {
      id: true,
      name: true,
      email: true,
      isActive: true,
      sessionEpoch: true,
    },
  });

  // Deleted, deactivated, or the epoch was bumped by a password change or a
  // "sign out everywhere" — the token is cryptographically fine but dead.
  if (!user || !user.isActive || user.sessionEpoch !== claims.epoch) {
    redirect("/admin/login?reason=expired");
  }

  return { id: user.id, name: user.name, email: user.email };
}

/** Non-redirecting variant, for deciding what to show on the login page. */
export async function getAdminOrNull(): Promise<AdminIdentity | null> {
  try {
    const token = (await cookies()).get(SESSION_COOKIE)?.value;
    const claims = await readSessionToken(token);
    if (!claims) return null;

    const user = await prisma.adminUser.findUnique({
      where: { id: claims.sub },
      select: { id: true, name: true, email: true, isActive: true, sessionEpoch: true },
    });

    if (!user || !user.isActive || user.sessionEpoch !== claims.epoch) return null;
    return { id: user.id, name: user.name, email: user.email };
  } catch {
    return null;
  }
}

import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE, readSessionToken } from "@/lib/auth/session";

/**
 * Redirects signed-out visitors away from /admin.
 *
 * This is a UX convenience, NOT the security boundary. It runs on the Edge
 * runtime, so it cannot reach the database — it can only confirm that a token
 * is well-formed, correctly signed and unexpired. It cannot know whether the
 * account still exists, is still active, or has had its sessions revoked.
 *
 * `requireAdmin()` in lib/auth/guard.ts answers those questions, and every
 * admin page, Server Action and route handler calls it. Nothing here is
 * trusted for authorization.
 */
export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const claims = await readSessionToken(
    request.cookies.get(SESSION_COOKIE)?.value,
  );

  // Already signed in and heading for the login page — send them inside.
  if (pathname === "/admin/login") {
    if (claims) return NextResponse.redirect(new URL("/admin", request.url));
    return NextResponse.next();
  }

  if (!claims) {
    const loginUrl = new URL("/admin/login", request.url);
    if (pathname !== "/admin") {
      loginUrl.searchParams.set("next", `${pathname}${search}`);
    }
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};

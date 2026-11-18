import type { Metadata } from "next";
import Link from "next/link";

import { LoginForm } from "@/components/admin/LoginForm";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reason?: string }>;
}) {
  const params = await searchParams;

  // Only ever an internal admin path, so a crafted ?next= cannot turn the
  // login form into an open redirect.
  const next =
    params.next && params.next.startsWith("/admin") ? params.next : undefined;

  return (
    <main className="flex min-h-screen items-center justify-center bg-linen px-4 py-16">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <span className="font-display text-3xl font-extrabold tracking-tight text-ink">
            Choice
          </span>
          <span className="mt-1 block text-[0.62rem] font-extrabold uppercase tracking-[0.34em] text-text-muted">
            Office Furniture
          </span>
        </div>

        <div className="rounded-card border border-line bg-white p-8 shadow-[0_30px_60px_-40px_rgba(59,42,30,0.5)]">
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink">
            Sign in
          </h1>
          <p className="mt-2 text-sm text-text-muted">
            Staff access only. This area manages live orders and stock.
          </p>

          {params.reason === "expired" ? (
            <p
              role="status"
              className="mt-4 rounded-md border border-oak bg-sand/40 px-3 py-2 text-sm text-espresso"
            >
              Your session ended. Please sign in again.
            </p>
          ) : null}

          <LoginForm next={next} />
        </div>

        <p className="mt-6 text-center text-xs text-text-muted">
          <Link className="underline hover:text-clay" href="/">
            ← Back to the shop
          </Link>
        </p>
      </div>
    </main>
  );
}

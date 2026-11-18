import type { Metadata } from "next";

import { AdminNav } from "@/components/admin/AdminNav";
import { requireAdmin } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { safeQuery } from "@/lib/safe";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Choice Admin" },
  robots: { index: false, follow: false },
};

/*
 * Never statically rendered: every page below reads the session cookie and
 * shows live business data.
 */
export const dynamic = "force-dynamic";

export default async function AdminDashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  /*
   * The authorization boundary. Middleware only redirected; this re-reads the
   * account, so a deactivated admin or a revoked session is stopped here.
   *
   * Every Server Action below calls requireAdmin() again — an action is its
   * own HTTP entry point and is not protected by this layout.
   */
  const admin = await requireAdmin();

  const pendingOrders = await safeQuery(
    "pending order count",
    () => prisma.order.count({ where: { status: "PENDING_CONFIRMATION" } }),
    0,
  );

  return (
    <div className="min-h-screen bg-linen lg:flex">
      <AdminNav admin={admin} pendingOrders={pendingOrders} />
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
        {children}
      </main>
    </div>
  );
}

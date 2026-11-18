"use client";

import {
  BarChart3,
  Boxes,
  FolderTree,
  LayoutDashboard,
  LogOut,
  Package,
  ReceiptText,
  Settings,
  UserCircle,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { logout } from "@/lib/actions/auth";

type NavLink = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Only Overview matches exactly; the rest match by prefix. */
  exact?: boolean;
};

const LINKS: NavLink[] = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/admin/products", label: "Products", icon: Package },
  { href: "/admin/categories", label: "Categories", icon: FolderTree },
  { href: "/admin/orders", label: "Orders", icon: ReceiptText },
  { href: "/admin/customers", label: "Customers", icon: Users },
  { href: "/admin/inventory", label: "Inventory", icon: Boxes },
  { href: "/admin/homepage", label: "Homepage", icon: BarChart3 },
  { href: "/admin/settings", label: "Settings", icon: Settings },
  { href: "/admin/profile", label: "Profile", icon: UserCircle },
];

export function AdminNav({
  admin,
  pendingOrders,
}: {
  admin: { name: string; email: string };
  pendingOrders: number;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Mobile bar */}
      <div className="flex items-center justify-between border-b border-line bg-cream px-4 py-3 lg:hidden">
        <span className="font-display text-lg font-extrabold tracking-tight text-ink">
          Choice Admin
        </span>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls="admin-nav"
          className="rounded-md border border-line px-3 py-1.5 text-sm font-semibold"
        >
          {open ? "Close" : "Menu"}
        </button>
      </div>

      <nav
        id="admin-nav"
        aria-label="Admin"
        className={`${
          open ? "block" : "hidden"
        } border-b border-line bg-cream px-3 py-4 lg:sticky lg:top-0 lg:block lg:h-screen lg:w-64 lg:shrink-0 lg:overflow-y-auto lg:border-r lg:border-b-0`}
      >
        <div className="mb-6 hidden px-3 lg:block">
          <span className="font-display text-xl font-extrabold tracking-tight text-ink">
            Choice
          </span>
          <span className="mt-0.5 block text-[0.58rem] font-extrabold uppercase tracking-[0.3em] text-text-muted">
            Admin
          </span>
        </div>

        <ul className="space-y-0.5">
          {LINKS.map((link) => {
            const active = link.exact
              ? pathname === link.href
              : pathname.startsWith(link.href);
            const Icon = link.icon;
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={() => setOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-semibold transition-colors ${
                    active
                      ? "bg-espresso text-cream"
                      : "text-espresso hover:bg-sand/50"
                  }`}
                >
                  <Icon size={17} aria-hidden="true" />
                  <span className="flex-1">{link.label}</span>
                  {/* Pending orders ride in the nav because an order that goes
                      unnoticed is indistinguishable from a broken website. */}
                  {link.href === "/admin/orders" && pendingOrders > 0 ? (
                    <span className="rounded-full bg-clay px-2 py-0.5 text-[0.7rem] font-bold text-white">
                      {pendingOrders}
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="mt-6 border-t border-line px-3 pt-4">
          <p className="truncate text-sm font-semibold text-espresso">{admin.name}</p>
          <p className="truncate text-xs text-text-muted">{admin.email}</p>
          <form action={logout} className="mt-3">
            <button
              type="submit"
              className="flex w-full items-center gap-2 rounded-md px-0 py-1 text-sm font-semibold text-text-muted transition-colors hover:text-clay"
            >
              <LogOut size={15} aria-hidden="true" />
              Sign out
            </button>
          </form>
        </div>
      </nav>
    </>
  );
}

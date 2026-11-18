import { PasswordForm } from "@/components/admin/PasswordForm";
import { requireAdmin } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Profile" };

export default async function AdminProfilePage() {
  const admin = await requireAdmin();
  const user = await prisma.adminUser.findUniqueOrThrow({
    where: { id: admin.id },
    select: { email: true, name: true, lastLoginAt: true, createdAt: true },
  });

  return (
    <div className="max-w-2xl space-y-6">
      <header>
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink">
          Profile
        </h1>
      </header>

      <section className="rounded-card border border-line bg-white p-6">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs font-bold uppercase tracking-[0.12em] text-text-muted">
              Name
            </dt>
            <dd className="mt-0.5 font-semibold text-espresso">{user.name}</dd>
          </div>
          <div>
            <dt className="text-xs font-bold uppercase tracking-[0.12em] text-text-muted">
              Email
            </dt>
            <dd className="mt-0.5 font-semibold text-espresso">{user.email}</dd>
          </div>
          <div>
            <dt className="text-xs font-bold uppercase tracking-[0.12em] text-text-muted">
              Last signed in
            </dt>
            <dd className="mt-0.5 text-text-muted">
              {user.lastLoginAt?.toLocaleString("en-GB") ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-bold uppercase tracking-[0.12em] text-text-muted">
              Account created
            </dt>
            <dd className="mt-0.5 text-text-muted">
              {user.createdAt.toLocaleDateString("en-GB")}
            </dd>
          </div>
        </dl>
      </section>

      <section className="rounded-card border border-line bg-white p-6">
        <h2 className="font-display text-lg font-extrabold text-ink">
          Change password
        </h2>
        <p className="mt-1 text-sm text-text-muted">
          Changing it signs out every device, including this one.
        </p>
        <PasswordForm />
      </section>
    </div>
  );
}

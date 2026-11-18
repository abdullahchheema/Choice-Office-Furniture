"use server";

import { cookies } from "next/headers";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth/guard";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { SESSION_COOKIE } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export type ProfileState = { error?: string; message?: string };

const PasswordSchema = z
  .object({
    current: z.string().min(1, "Enter your current password"),
    next: z
      .string()
      .min(12, "Use at least 12 characters")
      .max(200, "That is too long"),
    confirm: z.string(),
  })
  .refine((data) => data.next === data.confirm, {
    message: "The new passwords do not match",
    path: ["confirm"],
  });

export async function changePassword(
  _previous: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const admin = await requireAdmin();

  const parsed = PasswordSchema.safeParse({
    current: String(formData.get("current") ?? ""),
    next: String(formData.get("next") ?? ""),
    confirm: String(formData.get("confirm") ?? ""),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the details" };
  }

  const user = await prisma.adminUser.findUniqueOrThrow({
    where: { id: admin.id },
  });

  if (!(await verifyPassword(user.passwordHash, parsed.data.current))) {
    return { error: "Your current password is incorrect" };
  }

  /*
   * Bumping sessionEpoch is what makes a stateless JWT revocable: every
   * outstanding token carries the old epoch, requireAdmin() compares it, and
   * they all die at once. A password change should not leave an old session
   * alive on some other device.
   */
  await prisma.adminUser.update({
    where: { id: admin.id },
    data: {
      passwordHash: await hashPassword(parsed.data.next),
      sessionEpoch: { increment: 1 },
      failedLogins: 0,
      lockedUntil: null,
    },
  });

  // Including this one — the admin signs in again with the new password.
  (await cookies()).delete(SESSION_COOKIE);

  return {
    message:
      "Password changed. Every signed-in device, including this one, has been signed out.",
  };
}

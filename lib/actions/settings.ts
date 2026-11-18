"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth/guard";
import { normalisePhonePK } from "@/lib/phone";
import { prisma } from "@/lib/prisma";

export type SettingsState = {
  error?: string;
  saved?: boolean;
  fieldErrors?: Record<string, string>;
};

const SettingsSchema = z.object({
  brandName: z.string().trim().min(1, "Business name is required").max(120),
  tagline: z.string().trim().max(240).optional(),
  whatsapp: z.string().trim().min(1, "A WhatsApp number is required"),
  phone: z.string().trim().max(40).optional(),
  email: z.string().trim().max(160).optional(),
  addressLine: z.string().trim().max(240).optional(),
  city: z.string().trim().max(80).optional(),
  openingHours: z.string().trim().max(120).optional(),
  currencySymbol: z.string().trim().min(1).max(8),
  shippingFee: z
    .string()
    .trim()
    .regex(/^\d{1,10}(\.\d{1,2})?$/, "Delivery fee must be a number"),
  shippingNote: z.string().trim().max(240).optional(),
  facebookUrl: z.string().trim().max(240).optional(),
  instagramUrl: z.string().trim().max(240).optional(),
  linkedinUrl: z.string().trim().max(240).optional(),
  deliveryPolicy: z.string().trim().max(8000).optional(),
  returnPolicy: z.string().trim().max(8000).optional(),
  privacyPolicy: z.string().trim().max(20000).optional(),
  termsPolicy: z.string().trim().max(20000).optional(),
});

export async function updateSettings(
  _previous: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  await requireAdmin();

  const raw = Object.fromEntries(
    [...formData.entries()].map(([key, value]) => [
      key,
      typeof value === "string" ? value : "",
    ]),
  );

  const parsed = SettingsSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      fieldErrors[key] ??= issue.message;
    }
    return { fieldErrors };
  }

  const data = parsed.data;

  /*
   * The WhatsApp number is the one field the whole checkout depends on, so it
   * is normalised to E.164 here and rejected if it is not a reachable mobile.
   * A typo saved now would silently break every order later.
   */
  const whatsappE164 = normalisePhonePK(data.whatsapp);
  if (!whatsappE164) {
    return {
      fieldErrors: {
        whatsapp:
          "Enter a Pakistani mobile number, e.g. 0300 1234567 — WhatsApp cannot reach a landline.",
      },
    };
  }

  await prisma.websiteSetting.update({
    where: { id: "singleton" },
    data: {
      brandName: data.brandName,
      tagline: data.tagline || null,
      whatsappE164,
      whatsappDisplay: data.whatsapp,
      phone: data.phone || null,
      email: data.email || null,
      addressLine: data.addressLine || null,
      city: data.city || null,
      openingHours: data.openingHours || null,
      currencySymbol: data.currencySymbol,
      shippingFee: data.shippingFee,
      shippingNote: data.shippingNote || null,
      facebookUrl: data.facebookUrl || null,
      instagramUrl: data.instagramUrl || null,
      linkedinUrl: data.linkedinUrl || null,
      deliveryPolicy: data.deliveryPolicy || null,
      returnPolicy: data.returnPolicy || null,
      privacyPolicy: data.privacyPolicy || null,
      termsPolicy: data.termsPolicy || null,
    },
  });

  // Settings touch every page, so the whole storefront is refreshed.
  revalidatePath("/", "layout");
  return { saved: true };
}

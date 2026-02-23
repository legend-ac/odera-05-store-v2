import { z } from "zod";

export const storeSettingsSchema = z.object({
  storeName: z.string().min(2).max(80),
  homePromoEnabled: z.boolean().optional(),
  homePromo: z
    .object({
      title: z.string().max(80).optional(),
      message: z.string().max(220).optional(),
      rightNote: z.string().max(120).optional(),
      couponCode: z.string().max(40).optional(),
      freeShippingFrom: z.number().min(0).max(100000).optional(),
    })
    .optional(),
  publicContactEmail: z.union([z.literal(""), z.string().email().max(200)]),
  publicWhatsapp: z.union([z.literal(""), z.string().min(3).max(40)]),
  socialLinks: z
    .object({
      instagram: z.union([z.literal(""), z.string().url().max(300)]).optional(),
      tiktok: z.union([z.literal(""), z.string().url().max(300)]).optional(),
      facebook: z.union([z.literal(""), z.string().url().max(300)]).optional(),
      whatsapp: z.union([z.literal(""), z.string().url().max(300)]).optional(),
    })
    .optional(),
  paymentInstructions: z.object({
    yapeName: z.string().max(120).optional(),
    yapeNumber: z.string().max(40).optional(),
    plinName: z.string().max(120).optional(),
    plinNumber: z.string().max(40).optional(),
  }),
});

export type StoreSettingsInput = z.infer<typeof storeSettingsSchema>;

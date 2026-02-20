import { z } from "zod";

const shippingSchema = z.discriminatedUnion("method", [
  z.object({
    method: z.literal("LIMA_DELIVERY"),
    receiverName: z.string().min(2).max(120),
    receiverDni: z.string().min(8).max(20),
    receiverPhone: z.string().min(6).max(40),
    district: z.string().min(2).max(120),
    addressLine1: z.string().min(5).max(200),
    reference: z.string().max(200).optional(),
  }),
  z.object({
    method: z.literal("AGENCIA_PROVINCIA"),
    receiverName: z.string().min(2).max(120),
    receiverDni: z.string().min(8).max(20),
    receiverPhone: z.string().min(6).max(40),
    department: z.string().min(2).max(120),
    province: z.string().min(2).max(120),
    agencyName: z.string().min(2).max(120),
    agencyAddress: z.string().min(5).max(200),
    reference: z.string().max(200).optional(),
  }),
]);

export const createOrderSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        variantId: z.string().min(1),
        qty: z.number().int().min(1).max(50),
      })
    )
    .min(1)
    .max(50),
  customer: z.object({
    name: z.string().min(2).max(120),
    email: z.string().email().max(200),
    phone: z.string().min(6).max(40),
  }),
  shipping: shippingSchema,
  couponCode: z.string().min(3).max(40).optional(),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;

export const createOrderResponseSchema = z.object({
  publicCode: z.string(),
  trackingToken: z.string(),
  reservedUntilMs: z.number(),
  discountAmount: z.number().optional(),
  shippingCost: z.number().optional(),
  totalToPay: z.number().optional(),
});

export type CreateOrderResponse = z.infer<typeof createOrderResponseSchema>;

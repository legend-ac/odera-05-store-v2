import { z } from "zod";

export const adminUpdateOrderStatusSchema = z.object({
  orderId: z.string().min(1),
  nextStatus: z.enum(["PENDING_VALIDATION", "SCHEDULED", "PAYMENT_SENT", "PAID", "SHIPPED", "DELIVERED", "CANCELLED"]),
});

export type AdminUpdateOrderStatusInput = z.infer<typeof adminUpdateOrderStatusSchema>;

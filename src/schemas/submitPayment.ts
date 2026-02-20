import { z } from "zod";

export const submitPaymentSchema = z.object({
  publicCode: z.string().min(3).max(32),
  trackingToken: z.string().min(8).max(128),
  operationCode: z.string().min(4).max(64),
  method: z.enum(["YAPE", "PLIN", "OTHER"]),
});

export type SubmitPaymentInput = z.infer<typeof submitPaymentSchema>;

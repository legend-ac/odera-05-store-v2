import { z } from "zod";

export const submitPaymentSchema = z.object({
  publicCode: z.string().min(3).max(32),
  trackingToken: z.string().min(8).max(128),
  operationCode: z.string().trim().min(4).max(64).optional(),
  receiptImageUrl: z.string().url().max(1000).optional(),
  method: z.enum(["YAPE", "PLIN", "OTHER"]),
}).refine(value => Boolean(value.operationCode || value.receiptImageUrl), {
  message: "Envía un comprobante o el código de operación.",
  path: ["receiptImageUrl"],
});

export type SubmitPaymentInput = z.infer<typeof submitPaymentSchema>;

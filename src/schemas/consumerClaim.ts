import { z } from "zod";

export const consumerClaimSchema = z.object({
  kind: z.enum(["RECLAMO", "QUEJA"]),
  fullName: z.string().trim().min(3, "Ingresa tu nombre completo.").max(120),
  documentNumber: z.string().trim().min(5, "Ingresa un documento válido.").max(24),
  email: z.string().trim().email("Ingresa un correo válido.").max(200),
  phone: z.string().trim().min(6, "Ingresa un teléfono válido.").max(40),
  orderCode: z.string().trim().max(80).optional(),
  detail: z.string().trim().min(20, "Describe el caso con al menos 20 caracteres.").max(2500),
});

export type ConsumerClaimInput = z.infer<typeof consumerClaimSchema>;

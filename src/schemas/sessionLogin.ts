import { z } from "zod";

export const sessionLoginSchema = z.object({
  idToken: z.string().min(50),
});

export type SessionLoginInput = z.infer<typeof sessionLoginSchema>;

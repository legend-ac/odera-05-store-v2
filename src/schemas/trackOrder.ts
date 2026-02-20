import { z } from "zod";

export const trackOrderSchema = z.object({
  publicCode: z.string().min(3).max(32),
  trackingToken: z.string().min(8).max(128),
});

export type TrackOrderInput = z.infer<typeof trackOrderSchema>;

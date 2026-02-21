import { createHash } from "crypto";

export function buildIdempotencyDocId(ip: string, idempotencyKey: string): string {
  return createHash("sha256").update(`${ip}:${idempotencyKey}`).digest("hex").slice(0, 32);
}

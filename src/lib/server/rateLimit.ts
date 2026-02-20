import "server-only";

import { adminDb } from "@/lib/server/firebaseAdmin";
import { createHash } from "crypto";

export type RateLimitOptions = {
  ip: string;
  key: string; // e.g. "create-order"
  limit: number; // max requests
  windowMs: number; // rolling fixed window
};

function hashKey(s: string): string {
  return createHash("sha256").update(s).digest("hex").slice(0, 32);
}

export async function checkRateLimit(opts: RateLimitOptions): Promise<{ ok: boolean; remaining: number; resetAtMs: number }> {
  const now = Date.now();
  const docId = hashKey(`${opts.key}:${opts.ip}`);
  const ref = adminDb.collection("rateLimits").doc(docId);

  // Firestore-backed fixed window counter (cheap & simple; writes cost quota)
  let ok = true;
  let remaining = opts.limit;
  let resetAtMs = now + opts.windowMs;

  await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) {
      tx.set(ref, { count: 1, resetAtMs, key: opts.key, ip: opts.ip, createdAt: new Date() });
      remaining = opts.limit - 1;
      ok = true;
      return;
    }
    const data = snap.data() as { count?: number; resetAtMs?: number };
    const currentReset = typeof data.resetAtMs === "number" ? data.resetAtMs : 0;
    if (currentReset <= now) {
      resetAtMs = now + opts.windowMs;
      tx.set(ref, { count: 1, resetAtMs, key: opts.key, ip: opts.ip, createdAt: new Date() }, { merge: true });
      remaining = opts.limit - 1;
      ok = true;
      return;
    }
    const count = typeof data.count === "number" ? data.count : 0;
    const next = count + 1;
    resetAtMs = currentReset;
    if (next > opts.limit) {
      ok = false;
      remaining = 0;
      return;
    }
    tx.update(ref, { count: next });
    ok = true;
    remaining = opts.limit - next;
  });

  return { ok, remaining, resetAtMs };
}

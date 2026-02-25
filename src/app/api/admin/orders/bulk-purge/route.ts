import { NextResponse } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";
import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/server/firebaseAdmin";
import { assertCsrfHeader } from "@/lib/server/csrf";
import { SESSION_COOKIE_NAME, verifyAdminSessionCookie } from "@/lib/server/adminSession";
import { getRequestIp, getUserAgent } from "@/lib/server/ip";

export const runtime = "nodejs";
export const maxDuration = 60;

const bodySchema = z.object({
  olderThanDays: z.number().int().min(0).max(3650).optional(),
  limit: z.number().int().min(1).max(500).optional(),
});

export async function POST(req: Request) {
  try {
    assertCsrfHeader(req);
    const sessionCookie = cookies().get(SESSION_COOKIE_NAME)?.value;
    if (!sessionCookie) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    const admin = await verifyAdminSessionCookie(sessionCookie);

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "VALIDATION_ERROR", issues: parsed.error.issues }, { status: 400 });

    const now = Timestamp.now();
    const ip = getRequestIp(req);
    const ua = getUserAgent(req);
    const olderThanDays = parsed.data.olderThanDays ?? 0;
    const limit = parsed.data.limit ?? 300;
    const cutoffMs = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;

    const qs = await adminDb.collection("orders").orderBy("createdAt", "desc").limit(2000).get();
    const targets = qs.docs.filter((d) => {
      const o = d.data() as any;
      if (!o?.deletedAt) return false;
      if (olderThanDays > 0) {
        const deletedMs = typeof o.deletedAt?.toMillis === "function" ? o.deletedAt.toMillis() : null;
        if (!deletedMs || deletedMs > cutoffMs) return false;
      }
      return true;
    }).slice(0, limit);

    const batch = adminDb.batch();
    for (const doc of targets) {
      const o = doc.data() as any;
      batch.delete(doc.ref);
      const auditRef = adminDb.collection("auditLogs").doc();
      batch.set(auditRef, {
        actor: { uid: admin.uid, email: admin.email },
        action: "ORDER_BULK_PURGED",
        target: { type: "order", id: doc.id, publicCode: o?.publicCode ?? "" },
        before: { status: o?.status ?? "", deletedAt: o?.deletedAt ?? null },
        after: null,
        meta: { ip, userAgent: ua },
        createdAt: now,
      });
    }
    await batch.commit();

    return NextResponse.json({ ok: true, processed: targets.length }, { status: 200 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN_ERROR";
    const codeToStatus: Record<string, number> = {
      CSRF_FAILED: 403,
      NOT_ADMIN: 403,
      AUTH_TOO_OLD: 401,
    };
    return NextResponse.json({ error: msg }, { status: codeToStatus[msg] ?? 500 });
  }
}


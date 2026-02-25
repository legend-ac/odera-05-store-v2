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
  orderId: z.string().min(3),
});

export async function POST(req: Request) {
  try {
    assertCsrfHeader(req);
    const sessionCookie = cookies().get(SESSION_COOKIE_NAME)?.value;
    if (!sessionCookie) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    const admin = await verifyAdminSessionCookie(sessionCookie);

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "VALIDATION_ERROR", issues: parsed.error.issues }, { status: 400 });

    const ip = getRequestIp(req);
    const ua = getUserAgent(req);
    const now = Timestamp.now();
    const ref = adminDb.collection("orders").doc(parsed.data.orderId);

    await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new Error("ORDER_NOT_FOUND");
      const before = snap.data() as any;
      if (!before?.deletedAt) throw new Error("ORDER_NOT_TRASHED");

      tx.update(ref, {
        deletedAt: null,
        deletedBy: null,
        restoredAt: now,
        restoredBy: { uid: admin.uid, email: admin.email },
        updatedAt: now,
      });

      const auditRef = adminDb.collection("auditLogs").doc();
      tx.set(auditRef, {
        actor: { uid: admin.uid, email: admin.email },
        action: "ORDER_RESTORED",
        target: { type: "order", id: parsed.data.orderId, publicCode: before?.publicCode ?? "" },
        before: { deletedAt: before?.deletedAt ?? null },
        after: { deletedAt: null },
        meta: { ip, userAgent: ua },
        createdAt: now,
      });
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN_ERROR";
    const codeToStatus: Record<string, number> = {
      CSRF_FAILED: 403,
      NOT_ADMIN: 403,
      AUTH_TOO_OLD: 401,
      ORDER_NOT_FOUND: 404,
      ORDER_NOT_TRASHED: 409,
    };
    return NextResponse.json({ error: msg }, { status: codeToStatus[msg] ?? 500 });
  }
}


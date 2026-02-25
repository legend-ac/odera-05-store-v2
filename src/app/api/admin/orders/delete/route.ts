import { NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { z } from "zod";
import { cookies } from "next/headers";
import { adminDb } from "@/lib/server/firebaseAdmin";
import { assertCsrfHeader } from "@/lib/server/csrf";
import { SESSION_COOKIE_NAME, verifyAdminSessionCookie } from "@/lib/server/adminSession";
import { getRequestIp, getUserAgent } from "@/lib/server/ip";

export const runtime = "nodejs";
export const maxDuration = 60;

const bodySchema = z.object({
  orderId: z.string().min(3),
});

const ALLOWED_DELETE_STATUS = new Set(["CANCELLED", "CANCELLED_EXPIRED", "DELIVERED"]);

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
    const orderRef = adminDb.collection("orders").doc(parsed.data.orderId);

    await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(orderRef);
      if (!snap.exists) throw new Error("ORDER_NOT_FOUND");
      const before = snap.data() as any;
      const status = String(before?.status ?? "");
      if (!ALLOWED_DELETE_STATUS.has(status)) {
        throw new Error("ORDER_DELETE_NOT_ALLOWED_STATUS");
      }

      tx.delete(orderRef);
      const auditRef = adminDb.collection("auditLogs").doc();
      tx.set(auditRef, {
        actor: { uid: admin.uid, email: admin.email },
        action: "ORDER_DELETED",
        target: { type: "order", id: parsed.data.orderId, publicCode: before?.publicCode ?? "" },
        before: { status, publicCode: before?.publicCode ?? "", totals: before?.totals ?? null },
        after: null,
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
      ORDER_DELETE_NOT_ALLOWED_STATUS: 409,
    };
    return NextResponse.json({ error: msg }, { status: codeToStatus[msg] ?? 500 });
  }
}

